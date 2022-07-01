/**
 * graasp-websockets
 *
 * Fastify plugin for graasp-websockets
 *
 * Integrates the {@link WebSocketChannels} abstraction
 * in a fastify server plugin with fastify-websocket
 */
import Redis from 'ioredis';
import util from 'util';

import { FastifyLoggerInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import fws from 'fastify-websocket';

import config from './config';
import { AjvMessageSerializer } from './impls/message-serializer';
import { Service } from './impls/ws-service';
import { MultiInstanceChannelsBroker } from './multi-instance';
import { WebSocketChannels } from './ws-channels';

/**
 * Type definition for plugin options
 */
interface PluginOptions {
  prefix?: string;
  redis?: {
    config?: Redis.RedisOptions;
    channelName?: string;
  };
}

/**
 * Helper function to destructure options into useful config params
 */
function destructureOptions(options: PluginOptions) {
  const prefix = options.prefix ?? '/ws';
  const redis = {
    config: {
      ...options.redis?.config,
      port: options.redis?.config?.port ?? config.redis.port,
      host: options.redis?.config?.host ?? config.redis.host,
      password: options.redis?.config?.password ?? config.redis.password,
    },
    notifChannel: options.redis?.channelName ?? config.redis.notifChannel,
  };
  return { prefix, redis };
}

/**
 * Helper function to log boot message after plugin initialization
 */
function logBootMessage(log: FastifyLoggerInstance, config: PluginOptions) {
  // don't log password
  const publicRedisConfig = { ...config.redis };
  delete publicRedisConfig.config?.password;

  const prettyRedisConfig = util.inspect(publicRedisConfig, {
    breakLength: Infinity,
  });

  log.info(
    `graasp-websockets: plugin booted with prefix ${config.prefix} and Redis parameters ${prettyRedisConfig}`,
  );
}

const plugin: FastifyPluginAsync<PluginOptions> = async (fastify, options) => {
  // destructure passed fastify instance
  const { log, validateSession } = fastify;

  // configure plugin
  const config = destructureOptions(options);

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

  // Serializer / deserializer instance
  const serdes = new AjvMessageSerializer();

  // create channels abstraction instance
  const wsChannels = new WebSocketChannels(
    fastify.websocketServer,
    serdes.serialize,
    log,
  );

  // create multi-instance channels broker
  const wsMultiBroker = new MultiInstanceChannelsBroker(
    wsChannels,
    log,
    config.redis,
  );

  // create websockets service
  const wsService = new Service(wsChannels, wsMultiBroker, serdes.parse, log);

  // decorate server with service
  fastify.decorate('websockets', wsService);

  // decorate with debug internals in test mode
  if (process.env.NODE_ENV === 'test') {
    fastify.decorate('_debug_websocketsChannels', wsChannels);
  }

  fastify.register(async (fastify) => {
    // user must have valid session
    fastify.addHook('preHandler', validateSession);

    // handle incoming requests
    fastify.get(config.prefix, { websocket: true }, (conn, req) => {
      // raw websocket client
      const client = conn.socket;
      // member from valid session
      const { member } = req;

      wsChannels.clientRegister(client);

      client.on('message', (msg) =>
        wsService.handleRequest(msg, member, client),
      );

      client.on('close', (code, reason) => {
        wsChannels.clientRemove(client);
      });
    });
  });

  // cleanup on server close
  fastify.addHook('onClose', (instance, done) => {
    wsMultiBroker.close();
    wsChannels.close();
    done();
  });

  logBootMessage(log, config);
};

export default fp(plugin, {
  fastify: '3.x',
  name: 'graasp-websockets',
});
