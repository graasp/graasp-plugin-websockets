/**
 * graasp-websockets
 * 
 * Tests for {@link WebSocketChannels}
 * 
 * @author Alexandre CHAU
 */

/* eslint-disable @typescript-eslint/no-non-null-assertion */

import WebSocket from 'ws';
import { createPayloadMessage } from '../src/interfaces/message';
import { WebSocketChannels } from '../src/ws-channels';
import { clientSend, clientsWait, clientWait, createDefaultLocalConfig, createWsChannels, createWsClient, createWsClients, PortGenerator, TestConfig } from './test-utils';

const portGen = new PortGenerator(4000);

describe('Server internal behavior', () => {
    test("Client connecting to server is registered and then removed on close", async () => {
        const config = createDefaultLocalConfig({ port: portGen.getNewPort() });
        // we need to be informed when the client actually disconnects from the server side:
        const clientDisconnect = new Promise<WebSocketChannels>((resolve, reject) => {
            const { channels } = createWsChannels(config, client => {
                // we intercept server.on("connection") and add a close listener to resolve when client disconnects
                client.addEventListener("close", () => {
                    resolve(channels);
                });
            });
            // tell ESLint we are not expecting the following promise, but the one resolving above
            // eslint-disable-next-line jest/valid-expect-in-promise
            createWsClient(config).then(client => {
                // after client connected, it should be registered
                expect(channels.subscriptions.size).toEqual(1);
                // close from client side
                client.close();
            });
        });
        // wait until client disconnects
        const channels = await clientDisconnect;
        // after client closed, it should be unregistered
        expect(channels.subscriptions.size).toEqual(0);
    });
});

describe('Client requests are handled', () => {
    const testEnv: Partial<{
        config: TestConfig,
        channels: WebSocketChannels,
        wss: WebSocket.Server,
    }> = {};

    beforeAll(() => {
        testEnv.config = createDefaultLocalConfig({ port: portGen.getNewPort() });

        // create channels abstraction on some ws server
        const { channels, wss } = createWsChannels(testEnv.config);
        testEnv.channels = channels;
        testEnv.wss = wss;
    });

    test("Client sending an ill-formed request receives an error message", async () => {
        const msg = { wrong: "format" };
        const client = await createWsClient(testEnv.config!);
        const test = clientWait(client, 1).then(data => {
            expect(data).toStrictEqual({
                realm: "notif",
                error: {
                    "name": "Invalid request message",
                    "message": "Request message format was not understood by the server",
                },
            });
        });
        client.send(JSON.stringify(msg));
        client.close();
        return test;
    });

    afterAll(() => {
        testEnv.wss!.close();
    });
});


describe('Channel messages sent by server are received by clients', () => {
    const testEnv: Partial<{
        channels: WebSocketChannels,
        wss: WebSocket.Server,
        subs1: Array<WebSocket>,
        subs2: Array<WebSocket>,
    }> = {};


    beforeAll(async () => {
        const config = createDefaultLocalConfig({ port: portGen.getNewPort() });

        // create channels abstraction on some ws server
        const { channels, wss } = createWsChannels(config);
        testEnv.channels = channels;
        testEnv.wss = wss;

        // create some channels
        channels.channelCreate('1');
        channels.channelCreate('2');

        const numClients = 5;

        // spawn 5 clients and sub them to channel 1
        testEnv.subs1 = await createWsClients(config, numClients, (client, done) => {
            client.on('open', () => {
                clientSend(client, { realm: "notif", action: "subscribe", channel: "1" });
                done();
            });
        });

        // spawn 5 clients and sub them to channel 2
        testEnv.subs2 = await createWsClients(config, numClients, (client, done) => {
            client.on('open', () => {
                clientSend(client, { realm: "notif", action: "subscribe", channel: "2" });
                done();
            });
        });
    });

    test("Clients subscribed to channel '1' all receive 'msg1'", () => {
        const msg = createPayloadMessage('msg1');
        const test = clientsWait(testEnv.subs1!, 1).then(data => {
            data.forEach(value => {
                expect(value).toStrictEqual(msg);
            });
        });
        testEnv.channels!.channelSend('1', msg);
        return test;
    });

    test("Clients subscribed to channel '2' all receive 'msg2", () => {
        const msg = createPayloadMessage('msg2');
        const test = clientsWait(testEnv.subs2!, 1).then(data => {
            data.forEach(value => {
                expect(value).toStrictEqual(msg);
            });
        });
        testEnv.channels!.channelSend('2', msg);
        return test;
    });

    test("Clients subscribed to channel '2' all receive 'hello2' but not 'hello1' sent to channel '1'", () => {
        const msg = createPayloadMessage('hello2');
        const test = clientsWait(testEnv.subs2!, 1).then(data => {
            data.forEach(value => {
                expect(value).toStrictEqual(msg);
            });
        });
        const other = createPayloadMessage('hello1');
        testEnv.channels!.channelSend('1', other);
        testEnv.channels!.channelSend('2', msg);
        return test;
    });


    afterAll(() => {
        testEnv.subs1!.forEach(client => client.close());
        testEnv.subs2!.forEach(client => client.close());
        testEnv.wss!.close();
    });
});
