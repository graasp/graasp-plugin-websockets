import { WebSocketService } from './interfaces/ws-service';
import plugin from './service-api';

/**
 * Module augmention for fastify
 * Extends the FastifyInstance interface with a websockets service decorator
 */
declare module 'fastify' {
  interface FastifyInstance {
    websockets: WebSocketService;
  }
}

export default plugin;
export * from './interfaces';
