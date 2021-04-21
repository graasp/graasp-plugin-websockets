import 'fastify';
import { WebSocketChannels } from '../../src/ws-channels';

/** Extend fastify module with websocketChannels decorator */
declare module 'fastify' {
    export interface FastifyInstance<
        HttpServer = Server,
        HttpRequest = IncomingMessage,
        HttpResponse = ServerResponse,
        > {
        websocketChannels: WebSocketChannels;
    }
}