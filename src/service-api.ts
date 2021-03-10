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

    // must await this register call: otherwise decorated properties on `fastify` are not available
    await fastify.register(fws, {
        errorHandler: (error, conn, req, reply) => {
            console.error(`graasp-websockets: an error occured: ${error}\n\tDestroying connection ${conn}...`)
            conn.destroy(error)
        }
    })

    const wsServer = fastify.websocketServer
    const wsChannels = new WebSocketChannels(wsServer)

    wsServer.on('connection', (sock) => {
        console.debug(`graasp-websocket: new client`)
    })

    fastify.get(prefix, { websocket: true }, (connection, req) => {
        const ws = connection.socket

        wsChannels.clientRegister(ws)

        ws.on('message', (message) => {
            if (typeof(message) === 'string') {
                const channelName = message
                wsChannels.clientSubscribe(ws, channelName)
            }
        })

        ws.on('close', (code, reason) => {
            console.debug(`graasp-websocket: connection closed with code ${code}: ${reason}`)
            wsChannels.clientRemove(ws)
        })
    })
}

export default fp(plugin, {
    fastify: '3.x',
    name: 'graasp-websockets',
})