/**
 * graasp-websockets
 * 
 * Test utility functions and configuration
 * 
 * @author Alexandre CHAU
 */

import fastify, { FastifyInstance } from 'fastify'
import WebSocket from 'ws'
import graaspWebSockets from '../src/service-api'
import { WebSocketChannels } from '../src/ws-channels'

/**
 * Local tests network config
 */
const PORT = 3000
const ADDRESS = '127.0.0.1'
const PREFIX = '/ws'
const connUrl = `ws://${ADDRESS}:${PORT}${PREFIX}`

/**
 * Create a barebone websocket server and decorate it with the channels abstraction
 * @returns Object containing channels server and underlying ws server
 */
function createWsChannels(): { channels: WebSocketChannels, wss: WebSocket.Server } {
    const server = new WebSocket.Server({ port: PORT })
    const wsChannels = new WebSocketChannels(server)

    server.on('connection', ws => {
        wsChannels.clientRegister(ws)

        ws.on('message', data => {
            if (typeof (data) === 'string') {
                const channelName = data
                wsChannels.clientSubscribe(ws, channelName)
            }
        })
    })

    return {
        channels: wsChannels,
        wss: server,
    }
}

/**
 * Create a fastify server in which graasp-websockets plugin was registered
 * @returns Promise of fastify server instance with graasp-websockets plugin
 */
async function createWsFastifyInstance(): Promise<FastifyInstance> {
    const promise = new Promise<FastifyInstance>((resolve, reject) => {
        const server = fastify()

        server.register(graaspWebSockets, { prefix: PREFIX })

        server.listen(PORT, ADDRESS, (err, addr) => {
            if (err) {
                console.error(err)
                reject(err)
                process.exit(1)
            }
            console.log(`Server started on ${addr}`)
            resolve(server)
        })
    })

    return promise
}

/**
 * Create N barebone websocket clients
 * @param numberClients Number of websocket clients to spawn
 * @param setupFn Setup function passed to each of the N clients, the done callback parameter MUST be called inside!
 * @returns Promise of Array of N websocket clients
 */
async function createWsClients(numberClients: number, setupFn: (ws: WebSocket, done: () => void) => void): Promise<Array<WebSocket>> {
    const clients = Array(numberClients).fill(null).map(_ => new WebSocket(connUrl))
    return Promise.all(
        clients.map(client =>
            new Promise<WebSocket>((resolve, reject) => {
                const done = () => resolve(client)
                setupFn(client, done)
            })
        )
    )
}

/**
 * Waits for a client to receive a given number of messages
 * @param client Subject ws client that waits for messages
 * @param numberMessages Number of messages to wait for
 * @returns Received message if numberMessages == 1, else array of received messages
 */
async function clientWait(client: WebSocket, numberMessages: number): Promise<any | Array<any>> {
    return new Promise((resolve, reject) => {
        client.on('error', (err) => {
            reject(err)
        })

        if (numberMessages === 1) {
            client.on('message', (data) => {
                resolve(data)
            })
        } else {
            const buffer = []
            client.on('message', (data) => {
                buffer.push(data)
                if (buffer.length === numberMessages) {
                    resolve(buffer)
                }
            })
        }
    })
}

/**
 * Waits for an array of clients to receive a give number of messages
 * @param clients Array of clients that wait for messages
 * @param numberMessages Number of messages to wait for
 * @returns Array containing the received message or array of received messages for each client
 */
async function clientsWait(clients: Array<WebSocket>, numberMessages: number): Promise<Array<any>> {
    return Promise.all(
        clients.map(client => clientWait(client, numberMessages))
    )
}


export { createWsChannels, createWsClients, createWsFastifyInstance, clientsWait }
