/**
 * graasp-websockets
 *
 * Multi-instance broker for WS channels
 * Allows propagation of WS channels across multiple independent fastify instances through Redis
 *
 * ! In this file, we distinguish WS channels (part of the {@link WebSocketChannels} abstraction)
 * and Redis channels (from the Redis Pub/Sub mechanism which handles inter-instance communication) !
 *
 * @author Alexandre CHAU
 */

import { JTDSchemaType } from 'ajv-latest/dist/core';
import Ajv from 'ajv-latest/dist/jtd';
import Redis from 'ioredis';
import { WS_REALM_NOTIF } from './interfaces/constants';
import { Logger } from './interfaces/logger';
import { ClientMessage, ServerMessage } from './interfaces/message';
import { serverMessageSchema } from './schemas/message-schema';
import { WebSocketChannels } from './ws-channels';

/**
 * Represents deserialized messages sent over Redis
 * Wraps {@link ServerMessage} with meta to recognize underlying WS channels
 * @param realm must be WS_REALM_NOTIF to allow future-proofing
 * @param channel name of the WS channel on which to send the notification, or "broadcast" if it should be sent to all
 * @param notif notification to be sent on the WS channel
 */
interface RedisMessage {
  realm: typeof WS_REALM_NOTIF;
  channel: string | 'broadcast';
  notif: ServerMessage;
}

/**
 * Factory to transform a ServerMessage into a RedisMessage
 * @param serverMessage server message to send
 * @param channel WS channel name to send to, or "broadcast"
 */
function createRedisMessage(
  serverMessage: ServerMessage,
  channel: string | 'broadcast',
): RedisMessage {
  return {
    realm: WS_REALM_NOTIF,
    channel: channel,
    notif: serverMessage,
  };
}

/**
 * Redis message schema
 * MUST be equivalent to {@link RedisMessage}
 */
const redisMessageSchema: JTDSchemaType<RedisMessage> = {
  properties: {
    realm: { enum: ['notif'] },
    channel: { type: 'string' },
    notif: serverMessageSchema,
  },
};

// Serializer / deserializer instance to convert between RedisMessage and wire JSON strings sent to / received from Redis
const ajv = new Ajv();
const redisSerdes = {
  serialize: ajv.compileSerializer(redisMessageSchema),
  parse: ajv.compileParser(redisMessageSchema),
};

// Helper to create a redis client instance
function createRedisClientInstance(
  redisConfig: Redis.RedisOptions,
  log: Logger = console,
): Redis.Redis {
  const redis = new Redis(redisConfig);

  redis.on('error', (err) => {
    log.error(
      `graasp-websockets: MultiInstanceChannelsBroker failed to connect to Redis instance, reason:\n\t${err}`,
    );
  });

  return redis;
}

/**
 * Multi-instance broker abstraction
 * Handles connection and messages between fastify instances to transfer notifications
 */
class MultiInstanceChannelsBroker {
  // WS channels abstraction instance
  private readonly wsChannels: WebSocketChannels<ClientMessage, ServerMessage>;
  // Redis client subscriber instance
  private readonly sub: Redis.Redis;
  // Redis client publisher instance
  private readonly pub: Redis.Redis;
  // Notif channel name
  private readonly notifChannel: string;

  constructor(
    wsChannels: WebSocketChannels<ClientMessage, ServerMessage>,
    log: Logger = console,
    redisParams: {
      config: Redis.RedisOptions;
      notifChannel: string;
    },
  ) {
    this.wsChannels = wsChannels;
    this.notifChannel = redisParams.notifChannel;
    this.sub = createRedisClientInstance(redisParams.config, log);
    this.pub = createRedisClientInstance(redisParams.config, log);

    this.sub.subscribe(this.notifChannel, (err, count) => {
      if (err) {
        log.error(
          `graasp-websockets: MultiInstanceChannelsBroker failed to subscribe to ${this.notifChannel}, reason: ${err.message}`,
        );
        log.error(`\t${err}`);
      }
    });

    this.sub.on('message', (channel, message) => {
      if (channel === this.notifChannel) {
        const msg = redisSerdes.parse(message);
        if (msg === undefined) {
          log.info(
            `graasp-websockets: MultiInstanceChannelsBroker incorrect message received from Redis channel "${this.notifChannel}": ${message}`,
          );
        } else {
          // forward notification to respective channel
          if (msg.channel === 'broadcast') {
            this.wsChannels.broadcast(msg.notif);
          } else {
            this.wsChannels.channelSend(msg.channel, msg.notif);
          }
        }
      }
    });
  }

  /**
   * Send notification across instances INCLUDING THE CREATOR INSTANCE ITSELF
   * @param channel Name of the WS channel to send to, or "broadcast" if it should be sent to all clients across instances
   * @param notif Message to be sent on a given WS channel
   */
  dispatch(channel: string | 'broadcast', notif: ServerMessage): void {
    const msg = createRedisMessage(notif, channel);
    const json = redisSerdes.serialize(msg);
    this.pub.publish(this.notifChannel, json);
  }

  /**
   * Closes the MultiInstanceChannelsBroker
   * MUST be called when the fastify instance stops!
   */
  async close(): Promise<void> {
    // cleanup open resources
    await this.sub.unsubscribe(WS_REALM_NOTIF);
    this.sub.disconnect();
    this.pub.disconnect();
  }
}

export { MultiInstanceChannelsBroker };
