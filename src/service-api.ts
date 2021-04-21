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
import { Item } from 'graasp';
import { AjvMessageSerializer } from './impls/ajv-message-serializer';
import { ClientMessage, createErrorMessage, createPayloadMessage, ServerMessage } from './interfaces/message';
import { MessageSerializer } from './interfaces/message-serializer';
import { WebSocketChannels } from './ws-channels';

declare module 'fastify' {
    interface FastifyInstance {
        websocketChannels: WebSocketChannels<ClientMessage, ServerMessage>;
    }
}

interface GraaspWebsocketsPluginOptions {
    prefix: string;
}

// Serializer / Deserializer instance
const serdes: MessageSerializer<ClientMessage, ServerMessage> = new AjvMessageSerializer();

const plugin: FastifyPluginAsync<GraaspWebsocketsPluginOptions> = async (fastify, options) => {
    // destructure passed fastify instance
    const prefix = options.prefix ? options.prefix : '/ws';
    const {
        items: { taskManager },
        taskRunner: runner,
    } = fastify;

    // must await this register call: otherwise decorated properties on `fastify` are not available
    await fastify.register(fws, {
        errorHandler: (error, conn, req, reply) => {
            console.error(`graasp-websockets: an error occured: ${error}\n\tDestroying connection ${conn}...`);
            conn.destroy(error);
        }
    });

    const wsChannels = new WebSocketChannels(fastify.websocketServer, serdes);

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
                        // TODO: proper validation of channel before creating it
                        if (!wsChannels.channels.has(request.channel)) {
                            wsChannels.channelCreate(request.channel);
                        }
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

    /**
     * Register graasp behavior into websocket channels system
     */

    // on create item, notify parent
    const createItemTaskName = taskManager.getCreateTaskName();
    runner.setTaskPostHookHandler<Item>(createItemTaskName, async (item) => {
        const { id, name, path } = item;
        // TODO: use proper abstraction to find parent
        const tokens = path.split('.');
        if (tokens.length >= 2) {
            const parentId = tokens[tokens.length - 2].replace(/_/g, '-');
            wsChannels.channelSend(parentId, createPayloadMessage({ id, name }));
        }
    });
};

export default fp(plugin, {
    fastify: '3.x',
    name: 'graasp-websockets',
});