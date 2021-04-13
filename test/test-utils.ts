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
 * Create a barebone websocket server and decorate it with the channels abstraction
 * @returns Object containing channels server and underlying ws server
 */
function createWsChannels(config: { host: string, port: number }): { channels: WebSocketChannels, wss: WebSocket.Server } {
    const server = new WebSocket.Server({ port: config.port, host: config.host });
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
async function createFastifyInstance(config: { host: string, port: number }, setupFn: (instance: FastifyInstance) => void = _ => { /*noop*/ }): Promise<FastifyInstance> {
    const promise = new Promise<FastifyInstance>((resolve, reject) => {
        const server = fastify();

        setupFn(server);

        server.listen(config.port, config.host, (err, addr) => {
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
async function createWsFastifyInstance(config: { host: string, port: number, prefix: string }): Promise<FastifyInstance> {
    return createFastifyInstance(config, async instance => {
        await instance.register(graaspWebSockets, { prefix: config.prefix });
    });
}

/**
 * Creates a default local config for tests with 127.0.0.1 host and /ws prefix
 * @param options server configuration
 */
function createDefaultLocalConfig(options: { port: number }): { host: string, port: number, prefix: string } {
    return {
        host: '127.0.0.1',
        port: options.port,
        prefix: '/ws'
    };
}

/**
 * Creates a connection URL for a WebSocket.Client given
 * a host, port and prefix config
 */
function createConnUrl(config: { host: string, port: number, prefix: string }): string {
    return `ws://${config.host}:${config.port}${config.prefix}`;
}

/**
 * Create N barebone websocket clients
 * @param numberClients Number of websocket clients to spawn
 * @param setupFn Setup function passed to each of the N clients, the done callback parameter MUST be called inside!
 * @returns Promise of Array of N websocket clients
 */
async function createWsClients(config: { host: string, port: number, prefix: string }, numberClients: number, setupFn: (ws: WebSocket, done: () => void) => void): Promise<Array<WebSocket>> {
    const clients = Array(numberClients).fill(null).map(_ => new WebSocket(createConnUrl(config)));
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


export { createDefaultLocalConfig, createWsChannels, createWsClients, createFastifyInstance, createWsFastifyInstance, clientsWait };
