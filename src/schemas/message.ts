import { JTDSchemaType } from 'ajv/dist/jtd';

import { ClientMessage, ServerMessage } from '../interfaces/message';
import { errorSchema } from './error';

/**
 * Client message schema
 * MUST conform to {@link ClientMessage} (provide equivalent runtime types)
 */
export const clientMessageSchema: JTDSchemaType<ClientMessage> = {
  discriminator: 'action',
  mapping: {
    disconnect: {
      properties: {
        realm: { enum: ['notif'] },
      },
    },
    subscribe: {
      properties: {
        realm: { enum: ['notif'] },
        topic: { type: 'string' },
        channel: { type: 'string' },
      },
    },
    unsubscribe: {
      properties: {
        realm: { enum: ['notif'] },
        topic: { type: 'string' },
        channel: { type: 'string' },
      },
    },
    subscribeOnly: {
      properties: {
        realm: { enum: ['notif'] },
        topic: { type: 'string' },
        channel: { type: 'string' },
      },
    },
  },
};

/**
 * Server message schema
 * MUST conform to {@link ServerMessage} (provide equivalent runtime types)
 */
export const serverMessageSchema: JTDSchemaType<ServerMessage> = {
  discriminator: 'type',
  mapping: {
    response: {
      properties: {
        realm: { enum: ['notif'] },
        status: { enum: ['success', 'error'] },
      },
      optionalProperties: {
        error: errorSchema,
        request: clientMessageSchema,
      },
    },
    info: {
      properties: {
        realm: { enum: ['notif'] },
        message: { type: 'string' },
      },
      optionalProperties: {
        extra: {},
      },
    },
    update: {
      properties: {
        realm: { enum: ['notif'] },
        topic: { type: 'string' },
        channel: { type: 'string' },
      },
      optionalProperties: {
        body: {},
      },
    },
  },
};
