/**
 * graasp-websockets
 *
 * Fastify plugin for graasp-websockets
 *
 * Integrates the {@link WebSocketChannels} abstraction
 * in a fastify server plugin with fastify-websocket
 *
 * @author Alexandre CHAU
 */

import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import fws from 'fastify-websocket';
import { Item, ItemMembership } from 'graasp';
import Redis from 'ioredis';
import config from './config';
import { AjvMessageSerializer } from './impls/ajv-message-serializer';
import {
  WS_CLIENT_ACTION_DISCONNECT,
  WS_CLIENT_ACTION_SUBSCRIBE,
  WS_CLIENT_ACTION_SUBSCRIBE_ONLY,
  WS_CLIENT_ACTION_UNSUBSCRIBE,
  WS_ENTITY_ITEM,
  WS_ENTITY_MEMBER,
  WS_SERVER_ERROR_ACCESS_DENIED,
  WS_SERVER_ERROR_GENERIC,
  WS_SERVER_ERROR_INVALID_REQUEST,
  WS_SERVER_ERROR_NOT_FOUND,
  WS_UPDATE_OP_CREATE,
  WS_UPDATE_OP_DELETE,
} from './interfaces/constants';
import {
  ClientMessage,
  createChildItemUpdate,
  createServerErrorResponse,
  createServerSuccessResponse,
  createSharedWithUpdate,
  Error,
  ServerMessage,
} from './interfaces/message';
import { MessageSerializer } from './interfaces/message-serializer';
import { MultiInstanceChannelsBroker } from './multi-instance';
import { WebSocketChannels } from './ws-channels';

/**
 * Extend FastifyInstance class to decorate with WebSocketChannels instance when registered
 */
declare module 'fastify' {
  interface FastifyInstance {
    websocketChannels?: WebSocketChannels<ClientMessage, ServerMessage>;
    websocketChannelsBroker?: MultiInstanceChannelsBroker;
  }
}

/**
 * Type definition for plugin options
 */
interface GraaspWebsocketsPluginOptions {
  prefix?: string;
  redis?: {
    config?: Redis.RedisOptions;
    channelName?: string;
  };
}

// Serializer / Deserializer instance
const serdes: MessageSerializer<ClientMessage, ServerMessage> =
  new AjvMessageSerializer();

// Helpers to format errors
const subscribeErrorMessage = (errorName, channel, reason) => ({
  name: errorName,
  message: `Unable to subscribe to channel ${channel}: ${reason}`,
});
const notFoundError = (channel) =>
  subscribeErrorMessage(
    WS_SERVER_ERROR_NOT_FOUND,
    channel,
    'user or channel not found',
  );
const accessDeniedError = (channel) =>
  subscribeErrorMessage(
    WS_SERVER_ERROR_ACCESS_DENIED,
    channel,
    'user access denied for this channel',
  );

const plugin: FastifyPluginAsync<GraaspWebsocketsPluginOptions> = async (
  fastify,
  options,
) => {
  // destructure passed fastify instance
  const prefix = options.prefix ?? '/ws';
  const redis = {
    config: {
      ...options.redis,
      port: options.redis?.config?.port ?? config.redis.port,
      host: options.redis?.config?.host ?? config.redis.host,
      password: options.redis?.config?.password ?? config.redis.password,
    },
    notifChannel: options.redis?.channelName ?? config.redis.notifChannel,
  };
  const {
    items: { taskManager: itemTaskManager, dbService: itemDbService },
    itemMemberships: {
      taskManager: itemMembershipTaskManager,
      dbService: itemMembershipDbService,
    },
    taskRunner: runner,
    validateSession,
    db,
    log,
  } = fastify;

  // must await this register call: otherwise decorated properties on `fastify` are not available
  await fastify.register(fws, {
    errorHandler: (error, conn, req, reply) => {
      // remove client if needed
      if (wsChannels) {
        wsChannels.clientRemove(conn.socket);
      }
      log.error(
        `graasp-websockets: an error occured: ${error}\n\tDestroying connection`,
      );
      conn.destroy();
    },
  });

  const wsChannels = new WebSocketChannels(
    fastify.websocketServer,
    serdes,
    log,
  );

  // decorate main fastify instance with websocket channels instance
  fastify.decorate('websocketChannels', wsChannels);

  // multi-instance handler
  const channelsBroker = new MultiInstanceChannelsBroker(
    wsChannels,
    log,
    redis,
  );

  // decorate main fastify instance with multi-instance websocket channels broker
  fastify.decorate('websocketChannelsBroker', channelsBroker);

  // user must have valid session
  fastify.addHook('preHandler', validateSession);

  // cleanup on server close
  fastify.addHook('onClose', (instance, done) => {
    channelsBroker.close();
    done();
  });

  // helper to check if a user is allowed to subscribe to a channel
  async function userCanUseChannel(request, member): Promise<'ok' | Error> {
    // if channel entity is member and it is not the current user, deny access
    if (request.entity === WS_ENTITY_MEMBER && member.id !== request.channel) {
      return accessDeniedError(request.channel);
    }
    // if channel entity is item and user does not have permission, deny access
    else if (request.entity === WS_ENTITY_ITEM) {
      try {
        const item = await itemDbService.get(request.channel, db.pool);
        if (!item) {
          // item was not found
          return notFoundError(request.channel);
        }
        const allowed = await itemMembershipDbService.canRead(
          member.id,
          item,
          db.pool,
        );
        if (!allowed) {
          // user does not have permission
          return accessDeniedError(request.channel);
        }
      } catch (error) {
        log.error(`graasp-websockets: Unexpected server error: ${error}`);
        // database error
        return { name: WS_SERVER_ERROR_GENERIC, message: 'Database error' };
      }
    }
    return 'ok';
  }

  fastify.get(prefix, { websocket: true }, (connection, req) => {
    const client = connection.socket;
    const { member } = req;

    // register client into channels system
    wsChannels.clientRegister(client);

    /**
     * Handle incoming requests
     * Validate and dispatch received requests from client
     */
    client.on('message', async (message) => {
      const request = serdes.parse(message);
      if (request === undefined) {
        // validation error, send feedback
        const err = createServerErrorResponse({
          name: WS_SERVER_ERROR_INVALID_REQUEST,
          message: 'Request message format was not understood by the server',
        });
        wsChannels.clientSend(client, err);
      } else {
        // request is type-safe as a ClientMessage
        switch (request.action) {
          case WS_CLIENT_ACTION_DISCONNECT: {
            wsChannels.clientRemove(client);
            break;
          }
          case WS_CLIENT_ACTION_SUBSCRIBE: {
            const canUseOrError = await userCanUseChannel(request, member);
            if (canUseOrError !== 'ok') {
              wsChannels.clientSend(
                client,
                createServerErrorResponse(canUseOrError, request),
              );
              return;
            }

            // user is allowed, create channel if needed
            if (!wsChannels.channels.has(request.channel)) {
              wsChannels.channelCreate(request.channel, true);
            }

            const msg = wsChannels.clientSubscribe(client, request.channel)
              ? createServerSuccessResponse(request)
              : createServerErrorResponse(
                  notFoundError(request.channel),
                  request,
                );
            wsChannels.clientSend(client, msg);
            break;
          }
          case WS_CLIENT_ACTION_SUBSCRIBE_ONLY: {
            const canUseOrError = await userCanUseChannel(request, member);
            if (canUseOrError !== 'ok') {
              wsChannels.clientSend(
                client,
                createServerErrorResponse(canUseOrError, request),
              );
              return;
            }

            // user is allowed, create channel if needed
            if (!wsChannels.channels.has(request.channel)) {
              wsChannels.channelCreate(request.channel, true);
            }

            const msg = wsChannels.clientSubscribeOnly(client, request.channel)
              ? createServerSuccessResponse(request)
              : createServerErrorResponse(
                  notFoundError(request.channel),
                  request,
                );
            wsChannels.clientSend(client, msg);
            break;
          }
          case WS_CLIENT_ACTION_UNSUBSCRIBE: {
            const msg = wsChannels.clientUnsubscribe(client, request.channel)
              ? createServerSuccessResponse(request)
              : createServerErrorResponse(
                  notFoundError(request.channel),
                  request,
                );
            wsChannels.clientSend(client, msg);
            // preemptively remove channel if empty
            wsChannels.channelDelete(request.channel, true);
            break;
          }
        }
      }
    });

    // cleanup when client closes
    client.on('close', (code, reason) => {
      wsChannels.clientRemove(client);
    });
  });

  /**
   * Register graasp behavior into websocket channels system
   */

  // helper function to find parent of item
  // TODO: use proper abstraction to find parent
  function getParentId(item: Item): string | undefined {
    const { path } = item;
    const tokens = path.split('.');
    return tokens.length >= 2
      ? tokens[tokens.length - 2].replace(/_/g, '-')
      : undefined;
  }

  // helper function to extract child ID from item path
  // TODO: use proper abstraction to extract child ID
  function extractChildId(itemPath: string): string {
    const tokens = itemPath.split('.');
    return tokens[tokens.length - 1].replace(/_/g, '-');
  }

  // on create item, notify parent
  const createItemTaskName = itemTaskManager.getCreateTaskName();
  runner.setTaskPostHookHandler<Item>(createItemTaskName, async (item) => {
    const parentId = getParentId(item);
    if (parentId !== undefined) {
      channelsBroker.dispatch(
        parentId,
        createChildItemUpdate(parentId, WS_UPDATE_OP_CREATE, item),
      );
    }
  });

  // on delete item, notify parent
  const deleteItemTaskName = itemTaskManager.getDeleteTaskName();
  runner.setTaskPostHookHandler<Item>(deleteItemTaskName, async (item) => {
    const parentId = getParentId(item);
    if (parentId !== undefined) {
      channelsBroker.dispatch(
        parentId,
        createChildItemUpdate(parentId, WS_UPDATE_OP_DELETE, item),
      );
    }
  });

  // TODO: on delete item, notify item itself

  // TODO: on delete item, notify creator if they are admin

  // on delete item, notify members BEFORE WITH PREHOOK
  // (otherwise memberships already lost on cascade!)
  runner.setTaskPreHookHandler<Item>(
    deleteItemTaskName,
    async ({ id }, actor, { handler }) => {
      if (!id) {
        return;
      }
      const item = await itemDbService.get(id, handler);
      const memberIds = await itemDbService.membersWithSharedItem(
        item.path,
        handler,
      );
      memberIds.forEach((id) => {
        channelsBroker.dispatch(
          id,
          createSharedWithUpdate(id, WS_UPDATE_OP_DELETE, item),
        );
      });
    },
  );

  // TODO: on copy, if destination has parent notify

  // on item shared, notify members
  const createItemMembershipTaskName =
    itemMembershipTaskManager.getCreateTaskName();
  runner.setTaskPostHookHandler<ItemMembership>(
    createItemMembershipTaskName,
    async (membership, actor, { handler }) => {
      const item = await itemDbService.get(
        extractChildId(membership.itemPath),
        handler,
      );
      channelsBroker.dispatch(
        membership.memberId,
        createSharedWithUpdate(membership.memberId, WS_UPDATE_OP_CREATE, item),
      );
    },
  );

  // on membership deleted, notify members
  const deleteItemMembershipTaskName =
    itemMembershipTaskManager.getDeleteTaskName();
  runner.setTaskPreHookHandler<ItemMembership>(
    deleteItemMembershipTaskName,
    async ({ id }, actor, { handler }) => {
      if (!id) {
        return;
      }
      const membership = await itemMembershipDbService.get(id, handler);
      const item = await itemDbService.get(
        extractChildId(membership.itemPath),
        handler,
      );
      channelsBroker.dispatch(
        membership.memberId,
        createSharedWithUpdate(membership.memberId, WS_UPDATE_OP_DELETE, item),
      );
    },
  );

  log.info(`graasp-websockets: plugin booted with prefix ${prefix} and Redis config ${JSON.stringify(redis)}`);
};

export default fp(plugin, {
  fastify: '3.x',
  name: 'graasp-websockets',
});
