/**
 * graasp-websockets
 * 
 * Tests for {@link WebSocketChannels}
 * 
 * @author Alexandre CHAU
 */

/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { FastifyInstance } from 'fastify';
import waitForExpect from 'wait-for-expect';
import WebSocket from 'ws';
import { createPayloadMessage } from '../src/interfaces/message';
import { clientSend, clientsWait, clientWait, createDefaultLocalConfig, createWsChannels, createWsClient, createWsClients, createWsFastifyInstance, PortGenerator, TestConfig } from './test-utils';

const portGen = new PortGenerator(4000);

describe('Server internal behavior', () => {
    test("Adding / removing a channel is registered", () => {
        const config = createDefaultLocalConfig({ port: portGen.getNewPort() });
        const { channels: server, wss } = createWsChannels(config);
        expect(server.channels.size).toEqual(0);
        server.channelCreate("hello", false);
        expect(server.channels.size).toEqual(1);
        expect(server.channels.get("hello")).toEqual({ name: "hello", removeIfEmpty: false, subscribers: new Set() });
        server.channelCreate("world", false);
        expect(server.channels.size).toEqual(2);
        expect(server.channels.get("hello")).toEqual({ name: "hello", removeIfEmpty: false, subscribers: new Set() });
        expect(server.channels.get("world")).toEqual({ name: "world", removeIfEmpty: false, subscribers: new Set() });
        server.channelDelete("unknown");
        expect(server.channels.size).toEqual(2);
        server.channelDelete("hello");
        expect(server.channels.size).toEqual(1);
        expect(server.channels.get("hello")).toEqual(undefined);
        expect(server.channels.get("world")).toEqual({ name: "world", removeIfEmpty: false, subscribers: new Set() });
        server.channelDelete("world");
        expect(server.channels.size).toEqual(0);
        wss.close();
    });

    test("Client connecting to server is registered and then removed on close", async () => {
        const config = createDefaultLocalConfig({ port: portGen.getNewPort() });
        // we need to be informed when the client actually disconnects from the server side:
        return new Promise<void>((resolve, reject) => {
            createWsFastifyInstance(config, (client, server) => {
                // we intercept server.on("connection") and add a close listener to resolve when client disconnects
                client.addEventListener("close", () => {
                    // after client closed, it should be unregistered
                    expect(server.websocketChannels.subscriptions.size).toEqual(0);
                    server.close();
                    // test finishes here
                    resolve();
                });
            }).then(server => {
                createWsClient(config).then(client => {
                    // after client connected, it should be registered
                    expect(server.websocketChannels.subscriptions.size).toEqual(1);
                    client.close();
                });
            });
        });
    });

    test("Client sending a disconnect message is removed", async () => {
        const config = createDefaultLocalConfig({ port: portGen.getNewPort() });
        // we need to be informed when the client actually disconnects from the server side:
        return new Promise<void>((resolve, reject) => {
            createWsFastifyInstance(config, (client, server) => {
                // we intercept server.on("connection") and add a close listener to resolve when client disconnects
                client.addEventListener("message", () => {
                    // after client disconnected, it should be unregistered
                    expect(server.websocketChannels.subscriptions.size).toEqual(0);
                    server.close();
                    // test finishes here
                    resolve();
                });
            }).then(server => {
                createWsClient(config).then(client => {
                    // after client connected, it should be registered
                    expect(server.websocketChannels.subscriptions.size).toEqual(1);
                    clientSend(client, { realm: "notif", action: "disconnect" });
                    client.close();
                });
            });
        });
    });

    test("Client with broken connection is unregistered by heartbeat", async () => {
        const config = createDefaultLocalConfig({ port: portGen.getNewPort() });
        const { channels, wss } = createWsChannels(config, () => { /* noop */ }, 100);
        const clients = await createWsClients(config, 2);
        expect(channels.subscriptions.size).toEqual(2);
        // forcefully close client 0
        clients[0].terminate();
        // client 0 should not be registered anymmore
        await waitForExpect(() => {
            expect(channels.subscriptions.size).toEqual(1);
        });
        clients.forEach(client => client.close());
        wss.close();
    });

    test("Empty channel with removeIfEmpty flag is eventually removed by heartbeat", async () => {
        const config = createDefaultLocalConfig({ port: portGen.getNewPort() });
        const { channels, wss } = createWsChannels(config, () => { /* noop */ }, 100);
        channels.channelCreate("test", true);
        expect(channels.channels.size).toEqual(1);
        await waitForExpect(() => {
            expect(channels.channels.size).toEqual(0);
        });
        wss.close();
    });

    test("Client that is removed is also deleted from channel subscribers", async () => {
        const config = createDefaultLocalConfig({ port: portGen.getNewPort() });
        // we need to be informed when the client actually disconnects from the server side:
        return new Promise<void>((resolve, reject) => {
            createWsFastifyInstance(config, (client, server) => {
                // add a message listener to check if it was subscribed correctly
                client.addEventListener("message", () => {
                    expect(server.websocketChannels.channels.get('a')?.subscribers.size).toEqual(1);
                });
                // add a close listener to resolve when client disconnects
                client.addEventListener("close", () => {
                    // after client closed, channels should not see it as subscriber anymore
                    expect(server.websocketChannels.channels.get('a')?.subscribers.size).toEqual(0);
                    server.close();
                    // test finishes here
                    resolve();
                });
            }).then(server => {
                server.websocketChannels.channelCreate('a', false);
                createWsClient(config).then(client => {
                    // register to some channels
                    clientSend(client, { realm: "notif", action: "subscribe", channel: "a" });
                    client.close();
                });
            });
        });
    });

    test("Removing a channel with subscribers removes subscription from them", async () => {
        const config = createDefaultLocalConfig({ port: portGen.getNewPort() });
        return new Promise<void>((resolve, reject) => {
            createWsFastifyInstance(config, (client, server) => {
                // server receives subscription
                client.addEventListener("message", () => {
                    expect(server.websocketChannels.subscriptions.get(client)?.subscriptions.size).toEqual(1);
                    server.websocketChannels.channelDelete("a");
                    expect(server.websocketChannels.subscriptions.get(client)?.subscriptions.size).toEqual(0);
                    server.close();
                    resolve();
                });
            }).then(server => {
                server.websocketChannels.channelCreate('a', false);
                createWsClient(config).then(client => {
                    clientSend(client, { realm: "notif", action: "subscribe", channel: "a" });
                    client.close();
                });
            });
        });
    });
});

describe('Client requests are handled', () => {
    const testEnv: Partial<{
        config: TestConfig,
        server: FastifyInstance,
    }> = {};

    beforeAll(async () => {
        testEnv.config = createDefaultLocalConfig({ port: portGen.getNewPort() });
        testEnv.server = await createWsFastifyInstance(testEnv.config);
        testEnv.server.websocketChannels.channelCreate('1', false);
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

    test("Client using subscribeOnly on multiple channels only receives from last", async () => {
        const config = createDefaultLocalConfig({ port: portGen.getNewPort() });
        return new Promise<void>((resolve, reject) => {
            createWsFastifyInstance(config, (client, server) => {
                let msgCounter = 0;
                // add a message listener to check if it was subscribed correctly
                client.addEventListener("message", (data) => {
                    msgCounter += 1;
                    // server got all the messages
                    if (msgCounter === 4) {
                        server.websocketChannels.channelSend("1", createPayloadMessage("hello1"));
                        server.websocketChannels.channelSend("2", createPayloadMessage("hello2"));
                        server.websocketChannels.channelSend("3", createPayloadMessage("hello3"));
                        server.websocketChannels.channelSend("4", createPayloadMessage("hello4"));
                    }
                });
            }).then(server => {
                server.websocketChannels.channelCreate("1", false);
                server.websocketChannels.channelCreate("2", false);
                server.websocketChannels.channelCreate("3", false);
                server.websocketChannels.channelCreate("4", false);

                createWsClient(config).then(client => {
                    clientWait(client, 1).then(data => {
                        expect(data).toStrictEqual({
                            realm: "notif",
                            body: "hello4",
                        });
                        client.close();
                        server.close();
                        resolve();
                    });
                    clientSend(client, { realm: "notif", action: "subscribeOnly", channel: "1" });
                    clientSend(client, { realm: "notif", action: "subscribeOnly", channel: "2" });
                    clientSend(client, { realm: "notif", action: "subscribeOnly", channel: "3" });
                    clientSend(client, { realm: "notif", action: "subscribeOnly", channel: "4" });
                });
            });
        });
    });

    test("Client unsubscribing from a channel does not receive messages anymore", async () => {
        const config = createDefaultLocalConfig({ port: portGen.getNewPort() });
        return new Promise<void>((resolve, reject) => {
            createWsFastifyInstance(config, (client, server) => {
                let msgCounter = 0;
                // add a message listener to check if all messages were received
                client.addEventListener("message", (data) => {
                    msgCounter += 1;
                    if (msgCounter === 2) {
                        server.websocketChannels.channelSend("1", createPayloadMessage("you should not receive me"));
                    }
                    if (msgCounter === 3) {
                        server.websocketChannels.channelSend("1", createPayloadMessage("hello again"));
                    }
                });
            }).then(server => {
                server.websocketChannels.channelCreate("1", false);

                createWsClient(config).then(client => {
                    clientWait(client, 1).then(data => {
                        expect(data).toStrictEqual({
                            realm: "notif",
                            body: "hello again",
                        });
                        client.close();
                        server.close();
                        resolve();
                    });
                    clientSend(client, { realm: "notif", action: "subscribe", channel: "1" });
                    clientSend(client, { realm: "notif", action: "unsubscribe", channel: "1" });
                    clientSend(client, { realm: "notif", action: "subscribe", channel: "1" });
                });
            });
        });
    });

    afterAll(() => {
        testEnv.server!.close();
    });
});


describe('Channel messages sent by server are received by clients', () => {
    const testEnv: Partial<{
        server: FastifyInstance,
        subs1: Array<WebSocket>,
        subs2: Array<WebSocket>,
        unsubs: Array<WebSocket>,
    }> = {};


    beforeAll(async () => {
        const config = createDefaultLocalConfig({ port: portGen.getNewPort() });

        testEnv.server = await createWsFastifyInstance(config);

        // create some channels
        const channels = testEnv.server.websocketChannels;
        channels.channelCreate('1', false);
        channels.channelCreate('2', false);

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

        // spawn 5 clients and don't sub them
        testEnv.unsubs = await createWsClients(config, numClients);
    });

    test("Clients subscribed to channel '1' all receive 'msg1'", () => {
        const msg = createPayloadMessage('msg1');
        const test = clientsWait(testEnv.subs1!, 1).then(data => {
            data.forEach(value => {
                expect(value).toStrictEqual(msg);
            });
        });
        testEnv.server!.websocketChannels.channelSend('1', msg);
        return test;
    });

    test("Clients subscribed to channel '2' all receive 'msg2", () => {
        const msg = createPayloadMessage('msg2');
        const test = clientsWait(testEnv.subs2!, 1).then(data => {
            data.forEach(value => {
                expect(value).toStrictEqual(msg);
            });
        });
        testEnv.server!.websocketChannels.channelSend('2', msg);
        return test;
    });

    test("Clients subscribed to channel '2' all receive 'hello2' but not 'hello1' sent to channel '1'", () => {
        const hello2 = createPayloadMessage('hello2');
        const hello1 = createPayloadMessage('hello1');
        // ESLint does not detect that the promise is combined into Promise.all below
        // eslint-disable-next-line jest/valid-expect-in-promise
        const test1 = clientsWait(testEnv.subs1!, 1).then(data => {
            data.forEach(value => {
                expect(value).toStrictEqual(hello1);
            });
        });
        // ESLint does not detect that the promise is combined into Promise.all below
        // eslint-disable-next-line jest/valid-expect-in-promise
        const test2 = clientsWait(testEnv.subs2!, 1).then(data => {
            data.forEach(value => {
                expect(value).toStrictEqual(hello2);
            });
        });
        testEnv.server!.websocketChannels.channelSend('1', hello1);
        testEnv.server!.websocketChannels.channelSend('2', hello2);
        return Promise.all([test1, test2]);
    });

    test("All clients receive broadcasts even if not subscribed to channels", async () => {
        const broadcastMsg = createPayloadMessage({ hello: "world" });
        const clientsShouldReceive = new Array<WebSocket>().concat(testEnv.subs1!, testEnv.subs2!, testEnv.unsubs!);
        const test = clientsWait(clientsShouldReceive, 1).then(data => {
            data.forEach(value => {
                expect(value).toStrictEqual(broadcastMsg);
            });
        });
        testEnv.server!.websocketChannels.broadcast(broadcastMsg);
        return test;
    });


    afterAll(() => {
        testEnv.subs1!.forEach(client => client.close());
        testEnv.subs2!.forEach(client => client.close());
        testEnv.unsubs!.forEach(client => client.close());
        testEnv.server!.close();
    });
});
