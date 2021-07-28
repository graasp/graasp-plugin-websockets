import { WebSocketService } from './interfaces/ws-service';

/**
 * Module augmention for fastify
 * Extends the FastifyInstance interface with a websockets service decorator
 */
declare module 'fastify' {
  interface FastifyInstance {
    websockets: WebSocketService;
  }
}

export * from './service-api';
export * from './interfaces';