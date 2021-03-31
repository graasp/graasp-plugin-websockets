/**
 * graasp-websockets
 * 
 * Test utility functions and configuration
 * 
 * @author Alexandre CHAU
 */

import fastify, { FastifyInstance } from 'fastify';
import WebSocket from 'ws';
import graaspWebSockets from '../src/service-api';
import { WebSocketChannels } from '../src/ws-channels';

/**
 * Local tests network config
 */
const PORT = 3000;
const ADDRESS = '127.0.0.1';
const PREFIX = '/ws';
const connUrl = `ws://${ADDRESS}:${PORT}${PREFIX}`;

/** Exported config */
const config = {
    port: PORT,
    address: ADDRESS,
    prefix: PREFIX,
    connUrl: connUrl,
};

/**
 * Create a barebone websocket server and decorate it with the channels abstraction
 * @returns Object containing channels server and underlying ws server
 */
function createWsChannels(): { channels: WebSocketChannels, wss: WebSocket.Server } {
    const server = new WebSocket.Server({ port: PORT });
    const wsChannels = new WebSocketChannels(server);

    server.on('connection', ws => {
        wsChannels.clientRegister(ws);
    });

    return {
        channels: wsChannels,
        wss: server,
    };
}

/**
 * Creates a barebone fastify server
 * @param setupFn a setup function applied to the fastify instance before starting the server
 * @returns Promise of fastify server instance
 */
async function createFastifyInstance(setupFn: (instance: FastifyInstance) => void = _ => { /*noop*/ }): Promise<FastifyInstance> {
    const promise = new Promise<FastifyInstance>((resolve, reject) => {
        const server = fastify();

        setupFn(server);

        server.listen(PORT, ADDRESS, (err, addr) => {
            if (err) {
                reject(err.message);
            }
            resolve(server);
        });
    });

    return promise;
}

/**
 * Creates a fastify server in which graasp-websockets plugin was registered
 * @returns Promise of fastify server instance with graasp-websockets plugin
 */
async function createWsFastifyInstance(): Promise<FastifyInstance> {
    return createFastifyInstance(async instance => {
        await instance.register(graaspWebSockets, { prefix: PREFIX });
    });
}

/**
 * Create N barebone websocket clients
 * @param numberClients Number of websocket clients to spawn
 * @param setupFn Setup function passed to each of the N clients, the done callback parameter MUST be called inside!
 * @returns Promise of Array of N websocket clients
 */
async function createWsClients(numberClients: number, setupFn: (ws: WebSocket, done: () => void) => void): Promise<Array<WebSocket>> {
    const clients = Array(numberClients).fill(null).map(_ => new WebSocket(connUrl));
    return Promise.all(
        clients.map(client =>
            new Promise<WebSocket>((resolve, reject) => {
                const done = () => resolve(client);
                setupFn(client, done);
            })
        )
    );
}

/**
 * Waits for a client to receive a given number of messages
 * @param client Subject ws client that waits for messages
 * @param numberMessages Number of messages to wait for
 * @returns Received message if numberMessages == 1, else array of received messages
 */
async function clientWait(client: WebSocket, numberMessages: number): Promise<WebSocket.Data | Array<WebSocket.Data>> {
    return new Promise((resolve, reject) => {
        client.on('error', (err) => {
            reject(err);
        });

        if (numberMessages === 1) {
            client.on('message', (data) => {
                resolve(data);
            });
        } else {
            const buffer = [];
            client.on('message', (data) => {
                buffer.push(data);
                if (buffer.length === numberMessages) {
                    resolve(buffer);
                }
            });
        }
    });
}

/**
 * Waits for an array of clients to receive a give number of messages
 * @param clients Array of clients that wait for messages
 * @param numberMessages Number of messages to wait for
 * @returns Array containing the received message or array of received messages for each client
 */
async function clientsWait(clients: Array<WebSocket>, numberMessages: number): Promise<Array<WebSocket.Data | Array<WebSocket.Data>>> {
    return Promise.all(
        clients.map(client => clientWait(client, numberMessages))
    );
}


export { config, createWsChannels, createWsClients, createFastifyInstance, createWsFastifyInstance, clientsWait };
