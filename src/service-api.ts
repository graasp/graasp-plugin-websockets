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
import { ClientMessage, createErrorMessage, createPayloadMessage, ServerMessage } from './interfaces/message';
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

    // multi-instance handler
    const channelsBroker = new MultiInstanceChannelsBroker(wsChannels);

    // decorate main fastify instance with multi-instance websocket channels broker
    fastify.decorate('websocketChannelsBroker', channelsBroker);

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
                        const msg = (wsChannels.clientSubscribe(client, request.channel)) ?
                            createPayloadMessage({ status: "success", action: "subscribe", channel: request.channel }) :
                            createErrorMessage({ name: "Server error", message: "Unable to subscribe to channel " + request.channel });
                        wsChannels.clientSend(client, msg);
                        break;
                    }
                    case "subscribeOnly": {
                        const msg = (wsChannels.clientSubscribeOnly(client, request.channel)) ?
                            createPayloadMessage({ status: "success", action: "subscribeOnly", channel: request.channel }) :
                            createErrorMessage({ name: "Server error", message: "Unable to subscribe to channel " + request.channel });
                        wsChannels.clientSend(client, msg);
                        break;
                    }
                    case "unsubscribe": {
                        const msg = (wsChannels.clientUnsubscribe(client, request.channel)) ?
                            createPayloadMessage({ status: "success", action: "unsubscribe", channel: request.channel }) :
                            createErrorMessage({ name: "Server error", message: "Unable to unsubscribe from channel " + request.channel });
                        wsChannels.clientSend(client, msg);
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

    // cleanup on server close
    fastify.addHook("onClose", (instance, done) => {
        channelsBroker.close();
        done();
    });
};

export default fp(plugin, {
    fastify: '3.x',
    name: 'graasp-websockets',
});