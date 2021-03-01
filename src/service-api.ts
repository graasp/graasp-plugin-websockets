/**
 * Fastify plugin for graasp-websockets
 * 
 * Integrates the {@link channels-ws.ts} abstraction
 * in a fastify server plugin with fastify-websocket
 * 
 * @author Alexandre CHAU
 */

import { FastifyInstance, FastifyPluginAsync, FastifyPluginOptions } from 'fastify'
import fp from 'fastify-plugin'
import fws from 'fastify-websocket'
import { WebSocketChannels } from './ws-channels'

const plugin: FastifyPluginAsync = async (fastify: FastifyInstance, options: FastifyPluginOptions) => {
    const prefix = options.prefix ? options.prefix : '/ws'

    fastify.register(fws, {
        errorHandler: (error, conn, req, reply) => {
            console.error(`graasp-websockets: an error occured: ${error}\n\tDestroying connection ${conn}...`)
            conn.destroy(error)
        }
    })

    console.debug(fastify.websocketServer)
    const wsChannels = new WebSocketChannels(fastify.websocketServer)

    fastify.get(prefix, { websocket: true }, (connection, req) => {
        const ws = connection.socket

        ws.on('open', (sock) => {
            console.debug(`graasp-websocket: new client ${sock}`)
        })

        ws.on('close', (sock, code, reason) => {
            console.debug(`graasp-websocket: connection closed for ${sock} with code ${code}: ${reason}`)
        })

        ws.on('message', data => wsChannels.broadcast(data))
    })
}

export default fp(plugin, {
    fastify: '3.x',
    name: 'graasp-websockets',
})