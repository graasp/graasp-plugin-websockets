/**
 * Fastify plugin for graasp-websockets
 * 
 * Integrates the {@link WebSocketChannels} abstraction
 * in a fastify server plugin with fastify-websocket
 * 
 * @author Alexandre CHAU
 */

import { FastifyInstance, FastifyPluginAsync, FastifyPluginOptions } from 'fastify';
import fp from 'fastify-plugin';
import fws from 'fastify-websocket';
import { WebSocketChannels } from './ws-channels';

const plugin: FastifyPluginAsync = async (fastify: FastifyInstance, options: FastifyPluginOptions) => {
    const prefix = options.prefix ? options.prefix : '/ws';

    // must await this register call: otherwise decorated properties on `fastify` are not available
    await fastify.register(fws, {
        errorHandler: (error, conn, req, reply) => {
            console.error(`graasp-websockets: an error occured: ${error}\n\tDestroying connection ${conn}...`);
            conn.destroy(error);
        }
    });

    const wsChannels = new WebSocketChannels(fastify.websocketServer);

    fastify.get(prefix, { websocket: true }, (connection, req) => {
        wsChannels.clientRegister(connection.socket);
    });
};

export default fp(plugin, {
    fastify: '3.x',
    name: 'graasp-websockets',
});