/**
 * graasp-websockets
 * 
 * Test utility functions and configuration
 * 
 * @author Alexandre CHAU
 */

import fastify, { FastifyInstance } from 'fastify';
import WebSocket from 'ws';
import { AjvClientMessageSerializer } from '../client/impls/ajv-client-message-serializer';
import { ClientMessageSerializer } from '../client/interfaces/client-message-serializer';
import { ClientMessage, ServerMessage } from '../src/interfaces/message';
import graaspWebSockets from '../src/service-api';
import { WebSocketChannels } from '../src/ws-channels';

const serdes: ClientMessageSerializer = new AjvClientMessageSerializer();

/**
 * Test config type
 * Specifies server configuration for test run
 */
interface TestConfig {
    host: string,
    port: number,
    prefix: string,
}

/**
 * Creates a default local config for tests with 127.0.0.1 host and /ws prefix
 * @param options server configuration
 */
function createDefaultLocalConfig(options: { port: number }): TestConfig {
    return {
        host: '127.0.0.1',
        port: options.port,
        prefix: '/ws'
    };
}

/**
 * Utility class to generate new port numbers
 */
class PortGenerator {
    port: number;

    constructor(initPort: number) {
        this.port = initPort;
    }

    getNewPort(): number {
        this.port += 1;
        return this.port;
    }
}

/**
 * Create a barebone websocket server and decorate it with the channels abstraction
 * @returns Object containing channels server and underlying ws server
 */
function createWsChannels(config: TestConfig, clientConnOverrides: (client: WebSocket) => void = _ => { /* noop */ }): { channels: WebSocketChannels, wss: WebSocket.Server } {
    const server = new WebSocket.Server({ port: config.port });
    const wsChannels = new WebSocketChannels(server);

    server.on('connection', ws => {
        wsChannels.clientRegister(ws);
        clientConnOverrides(ws);
    });

    server.on('error', err => {
        throw err;
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
async function createFastifyInstance(config: TestConfig, setupFn: (instance: FastifyInstance) => void = _ => { /*noop*/ }): Promise<FastifyInstance> {
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
async function createWsFastifyInstance(config: TestConfig): Promise<FastifyInstance> {
    return createFastifyInstance(config, async instance => {
        await instance.register(graaspWebSockets, { prefix: config.prefix });
    });
}

/**
 * Creates a connection URL for a WebSocket.Client given
 * a host, port and prefix config
 */
function createConnUrl(config: TestConfig): string {
    return `ws://${config.host}:${config.port}${config.prefix}`;
}

/**
 * Create a barebone websocket client
 * @param setupFn Setup function for the client. The done callback parameter MUST be called inside!
 * @returns Promise of websocket client
 */
async function createWsClient(config: TestConfig, setupFn: (ws: WebSocket, done: () => void) => void = (client, done) => client.on("open", () => done())): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
        const client = new WebSocket(createConnUrl(config));
        const done = () => resolve(client);
        setupFn(client, done);
    });
}

/**
 * Create N barebone websocket clients
 * @param numberClients Number of websocket clients to spawn
 * @param setupFn Setup function passed to each of the N clients, the done callback parameter MUST be called inside!
 * @returns Promise of Array of N websocket clients
 */
async function createWsClients(config: TestConfig, numberClients: number, setupFn: (ws: WebSocket, done: () => void) => void = (client, done) => client.on("open", () => done())): Promise<Array<WebSocket>> {
    const clients = Array(numberClients).fill(null).map(_ => createWsClient(config, setupFn));
    return Promise.all(clients);
}

/**
 * Waits for a client to receive a given number of messages
 * @param client Subject ws client that waits for messages
 * @param numberMessages Number of messages to wait for
 * @returns Received message if numberMessages == 1, else array of received messages
 */
async function clientWait(client: WebSocket, numberMessages: number): Promise<ServerMessage | Array<ServerMessage>> {
    return new Promise((resolve, reject) => {
        client.on('error', (err) => {
            reject(err);
        });

        if (numberMessages === 1) {
            client.on('message', (data) => {
                const msg = serdes.parse(data);
                if (msg === undefined) reject(new Error(`Parsing error: server message could not be converted: ${data}`));
                else resolve(msg);
            });
        } else {
            const buffer: Array<ServerMessage> = [];
            client.on('message', (data) => {
                const msg = serdes.parse(data);
                if (msg === undefined) reject(new Error(`Parsing error: server message could not be converted: ${data}`));
                else buffer.push(msg);
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
async function clientsWait(clients: Array<WebSocket>, numberMessages: number): Promise<Array<ServerMessage | Array<ServerMessage>>> {
    return Promise.all(
        clients.map(client => clientWait(client, numberMessages))
    );
}

/**
 * Performs necessary conversion to send valid message from client
 * @param data ClientMessage to be sent
 */
function clientSend(client: WebSocket, data: ClientMessage): void {
    client.send(serdes.serialize(data));
}


export { TestConfig, PortGenerator, createDefaultLocalConfig, createWsChannels, createWsClient, createWsClients, createFastifyInstance, createWsFastifyInstance, clientWait, clientsWait, clientSend };
