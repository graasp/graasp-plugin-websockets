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
import { AjvMessageSerializer } from './impls/ajv-message-serializer';
import { ClientMessage, createChildItemUpdate, createServerErrorResponse, createServerSuccessResponse, createSharedWithUpdate, ServerMessage } from './interfaces/message';
import { MessageSerializer } from './interfaces/message-serializer';
import { MultiInstanceChannelsBroker } from './multi-instance';
import { WebSocketChannels } from './ws-channels';

/**
 * Extend FastifyInstance class to decorate with WebSocketChannels instance when registered
 */
declare module 'fastify' {
    interface FastifyInstance {
        websocketChannels: WebSocketChannels<ClientMessage, ServerMessage>;
        websocketChannelsBroker: MultiInstanceChannelsBroker;
    }
}

/**
 * Type definition for plugin options
 */
interface GraaspWebsocketsPluginOptions {
    prefix: string;
}

// Serializer / Deserializer instance
const serdes: MessageSerializer<ClientMessage, ServerMessage> = new AjvMessageSerializer();

// Helper to format NOT_FOUND error message
const notFoundErrorMessage = (channel) => `Unable to subscribe to channel ${channel}: user or channel not found`;

const plugin: FastifyPluginAsync<GraaspWebsocketsPluginOptions> = async (fastify, options) => {
    // destructure passed fastify instance
    const prefix = options.prefix ? options.prefix : '/ws';
    const {
        items: { taskManager: itemTaskManager },
        itemMemberships: { taskManager: itemMembershipTaskManager },
        taskRunner: runner,
        validateSession,
    } = fastify;

    // must await this register call: otherwise decorated properties on `fastify` are not available
    await fastify.register(fws, {
        errorHandler: (error, conn, req, reply) => {
            console.error(`graasp-websockets: an error occured: ${error}\n\tDestroying connection ${conn}...`);
            conn.destroy();
        }
    });

    const wsChannels = new WebSocketChannels(fastify.websocketServer, serdes);

    // decorate main fastify instance with websocket channels instance
    fastify.decorate('websocketChannels', wsChannels);

    // multi-instance handler
    const channelsBroker = new MultiInstanceChannelsBroker(wsChannels);

    // decorate main fastify instance with multi-instance websocket channels broker
    fastify.decorate('websocketChannelsBroker', channelsBroker);

    // user must have valid session
    // TODO: fix crash when user doesn't have valid session
    fastify.addHook('preHandler', validateSession);

    // cleanup on server close
    fastify.addHook("onClose", (instance, done) => {
        channelsBroker.close();
        done();
    });

    fastify.get(prefix, { websocket: true }, (connection, req) => {
        const client = connection.socket;

        // register client into channels system
        wsChannels.clientRegister(client);

        /**
         * Handle incoming requests
         * Validate and dispatch received requests from client
         */
        client.on('message', (message) => {
            const request = serdes.parse(message);
            if (request === undefined) {
                // validation error, send feedback
                const err = createServerErrorResponse({
                    name: "INVALID_REQUEST",
                    message: "Request message format was not understood by the server"
                });
                wsChannels.clientSend(client, err);
            } else {
                // request is type-safe as a ClientMessage
                switch (request.action) {
                    case "disconnect": {
                        wsChannels.clientRemove(client);
                        break;
                    }
                    case "subscribe": {
                        // TODO: proper validation of channel before creating it
                        if (!wsChannels.channels.has(request.channel)) {
                            wsChannels.channelCreate(request.channel, true);
                        }

                        const msg = (wsChannels.clientSubscribe(client, request.channel)) ?
                            createServerSuccessResponse(request) :
                            createServerErrorResponse({ name: "NOT_FOUND", message: notFoundErrorMessage(request.channel) });
                        wsChannels.clientSend(client, msg);
                        break;
                    }
                    case "subscribeOnly": {
                        // TODO: proper validation of channel before creating it
                        if (!wsChannels.channels.has(request.channel)) {
                            wsChannels.channelCreate(request.channel, true);
                        }

                        const msg = (wsChannels.clientSubscribeOnly(client, request.channel)) ?
                            createServerSuccessResponse(request) :
                            createServerErrorResponse({ name: "NOT_FOUND", message: notFoundErrorMessage(request.channel) });
                        wsChannels.clientSend(client, msg);
                        break;
                    }
                    case "unsubscribe": {
                        const msg = (wsChannels.clientUnsubscribe(client, request.channel)) ?
                            createServerSuccessResponse(request) :
                            createServerErrorResponse({ name: "NOT_FOUND", message: notFoundErrorMessage(request.channel) });
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
        return (tokens.length >= 2) ? tokens[tokens.length - 2].replace(/_/g, '-') : undefined;
    }

    function extractChildId(itemPath: string): string {
        const tokens = itemPath.split('.');
        return tokens[tokens.length - 1];
    }

    // on create item, notify parent
    const createItemTaskName = itemTaskManager.getCreateTaskName();
    runner.setTaskPostHookHandler<Item>(createItemTaskName, async (item) => {
        const parentId = getParentId(item);
        if (parentId !== undefined) {
            channelsBroker.dispatch(parentId, createChildItemUpdate(parentId, "create", item));
        }
    });

    // on delete item, notify parent
    const deleteItemTaskName = itemTaskManager.getDeleteTaskName();
    runner.setTaskPostHookHandler<Item>(deleteItemTaskName, async (item) => {
        const parentId = getParentId(item);
        if (parentId !== undefined) {
            channelsBroker.dispatch(parentId, createChildItemUpdate(parentId, "delete", item));
        }
    });

    // on item shared, notify members
    const createItemMembershipTaskName = itemMembershipTaskManager.getCreateTaskName();
    runner.setTaskPostHookHandler<ItemMembership>(createItemMembershipTaskName, async (membership) => {
        const item = await ; // TODO: get item
        channelsBroker.dispatch(membership.memberId, createSharedWithUpdate(membership.memberId, "create", item));
    });
};

export default fp(plugin, {
    fastify: '3.x',
    name: 'graasp-websockets',
});