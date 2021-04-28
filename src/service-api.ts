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
import { AjvMessageSerializer } from './impls/ajv-message-serializer';
import { ClientMessage, createErrorMessage, ServerMessage } from './interfaces/message';
import { MessageSerializer } from './interfaces/message-serializer';
import { WebSocketChannels } from './ws-channels';

/**
 * Extend FastifyInstance class to decorate with WebSocketChannels instance when registered
 */
declare module 'fastify' {
    interface FastifyInstance {
        websocketChannels: WebSocketChannels<ClientMessage, ServerMessage>;
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

const plugin: FastifyPluginAsync<GraaspWebsocketsPluginOptions> = async (fastify, options) => {
    const prefix = options.prefix ? options.prefix : '/ws';

    // must await this register call: otherwise decorated properties on `fastify` are not available
    await fastify.register(fws, {
        errorHandler: (error, conn, req, reply) => {
            console.error(`graasp-websockets: an error occured: ${error}\n\tDestroying connection ${conn}...`);
            conn.destroy(error);
        }
    });

    const wsChannels = new WebSocketChannels(fastify.websocketServer, serdes);

    // decorate main fastify instance with websocket channels instance
    fastify.decorate('websocketChannels', wsChannels);

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
                const err = createErrorMessage({
                    name: "Invalid request message",
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
                        wsChannels.clientSubscribe(client, request.channel);
                        break;
                    }
                    case "subscribeOnly": {
                        wsChannels.clientSubscribeOnly(client, request.channel);
                        break;
                    }
                    case "unsubscribe": {
                        wsChannels.clientUnsubscribe(client, request.channel);
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
};

export default fp(plugin, {
    fastify: '3.x',
    name: 'graasp-websockets',
});