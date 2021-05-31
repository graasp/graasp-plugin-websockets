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
import { serverMessageSchema } from '../src/schemas/message-schema';
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
        const server = await createWsFastifyInstance(config);
        const client = await createWsClient(config);
        expect(server.websocketChannels.subscriptions.size).toEqual(1);
        client.close();
        await waitForExpect(() => {
            expect(server.websocketChannels.subscriptions.size).toEqual(0);
        });
        await server.close();
    });

    test("Client sending a disconnect message is removed", async () => {
        const config = createDefaultLocalConfig({ port: portGen.getNewPort() });
        const server = await createWsFastifyInstance(config);
        const client = await createWsClient(config);
        expect(server.websocketChannels.subscriptions.size).toEqual(1);
        clientSend(client, { realm: "notif", action: "disconnect" });
        await waitForExpect(() => {
            expect(server.websocketChannels.subscriptions.size).toEqual(0);
        });
        client.close();
        await server.close();
    });

    test("Client with broken connection is unregistered by heartbeat", async () => {
        const config = createDefaultLocalConfig({ port: portGen.getNewPort() });
        const { channels, wss } = createWsChannels(config, 100);
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
        const { channels, wss } = createWsChannels(config, 100);
        channels.channelCreate("test", true);
        expect(channels.channels.size).toEqual(1);
        await waitForExpect(() => {
            expect(channels.channels.size).toEqual(0);
        });
        wss.close();
    });

    test("Channel with removeIfEmpty is removed when its last subscriber unsubscribes from it", async () => {
        const config = createDefaultLocalConfig({ port: portGen.getNewPort() });
        const server = await createWsFastifyInstance(config);
        server.websocketChannels.channelCreate('a', true);
        const client = await createWsClient(config);

        // subscribe to channel "a" and await ack
        const ack = clientWait(client, 1);
        clientSend(client, { realm: "notif", action: "subscribe", channel: "a" });
        const ackMsg = await ack;
        expect(ackMsg).toMatchObject({ body: { status: "success", action: "subscribe", channel: "a" } });
        expect(server.websocketChannels.channels.get('a')?.subscribers.size).toEqual(1);

        // unsubscribe from channel "a" and await ack
        const ack2 = clientWait(client, 1);
        clientSend(client, { realm: "notif", action: "unsubscribe", channel: "a" });
        const ack2Msg = await ack2;
        expect(ack2Msg).toMatchObject({ body: { status: "success", action: "unsubscribe", channel: "a" } });
        expect(server.websocketChannels.channels.get('a')).toBeUndefined();

        client.close();
        server.close();
    });

    test("Client that is removed is also deleted from channel subscribers", async () => {
        const config = createDefaultLocalConfig({ port: portGen.getNewPort() });
        const server = await createWsFastifyInstance(config);
        server.websocketChannels.channelCreate('a', false);
        const client = await createWsClient(config);

        // subscribe to channel "a" and await ack
        const ack = clientWait(client, 1);
        clientSend(client, { realm: "notif", action: "subscribe", channel: "a" });
        const ackMsg = await ack;
        expect(ackMsg).toMatchObject({ body: { status: "success", action: "subscribe", channel: "a" } });
        expect(server.websocketChannels.channels.get('a')?.subscribers.size).toEqual(1);

        client.close();
        await waitForExpect(() => {
            // after client closed, channels should not see it as subscriber anymore
            expect(server.websocketChannels.channels.get('a')?.subscribers.size).toEqual(0);
        });
        await server.close();
    });

    test("Removing a channel with subscribers removes subscription from them", async () => {
        const config = createDefaultLocalConfig({ port: portGen.getNewPort() });
        const server = await createWsFastifyInstance(config);
        server.websocketChannels.channelCreate('a', false);
        const client = await createWsClient(config);

        // subscribe to channel "a" and await ack
        const ack = clientWait(client, 1);
        clientSend(client, { realm: "notif", action: "subscribe", channel: "a" });
        const ackMsg = await ack;
        expect(ackMsg).toMatchObject({ body: { status: "success", action: "subscribe", channel: "a" } });
        expect(server.websocketChannels.channels.get('a')?.subscribers.size).toEqual(1);

        server.websocketChannels.subscriptions.forEach(client => {
            expect(client.subscriptions.size).toEqual(1);
        });

        server.websocketChannels.channelDelete("a");

        server.websocketChannels.subscriptions.forEach(client => {
            expect(client.subscriptions.size).toEqual(0);
        });

        client.close();
        await server.close();
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
        const response = clientWait(client, 1);
        client.send(JSON.stringify(msg));
        const data = await response;
        expect(data).toStrictEqual({
            realm: "notif",
            error: {
                "name": "Invalid request message",
                "message": "Request message format was not understood by the server",
            },
        });
        client.close();
    });

    test("Client using subscribeOnly on multiple channels only receives from last", async () => {
        const config = createDefaultLocalConfig({ port: portGen.getNewPort() });
        const server = await createWsFastifyInstance(config);
        server.websocketChannels.channelCreate("1", false);
        server.websocketChannels.channelCreate("2", false);
        server.websocketChannels.channelCreate("3", false);
        server.websocketChannels.channelCreate("4", false);

        // subscribe only 4 times in a row to 4 channels
        const client = await createWsClient(config);
        const acks = clientWait(client, 4);
        clientSend(client, { realm: "notif", action: "subscribeOnly", channel: "1" });
        clientSend(client, { realm: "notif", action: "subscribeOnly", channel: "2" });
        clientSend(client, { realm: "notif", action: "subscribeOnly", channel: "3" });
        clientSend(client, { realm: "notif", action: "subscribeOnly", channel: "4" });
        const ackMsgs = await acks;
        const expectedAckMsgs = ["1", "2", "3", "4"].map(c => ({ body: { status: "success", action: "subscribeOnly", channel: c } }));
        expect(ackMsgs).toMatchObject(expectedAckMsgs);

        // wait for a single message: should only received from channel "4"
        const waitMsg = clientWait(client, 1);
        server.websocketChannels.channelSend("1", createPayloadMessage("hello1"));
        server.websocketChannels.channelSend("2", createPayloadMessage("hello2"));
        server.websocketChannels.channelSend("3", createPayloadMessage("hello3"));
        server.websocketChannels.channelSend("4", createPayloadMessage("hello4"));
        const data = await waitMsg;
        expect(data).toStrictEqual({
            realm: "notif",
            body: "hello4",
        });

        client.close();
        await server.close();
    });

    test("Client unsubscribing from a channel does not receive messages anymore", async () => {
        const config = createDefaultLocalConfig({ port: portGen.getNewPort() });
        const server = await createWsFastifyInstance(config);
        server.websocketChannels.channelCreate("1", false);
        const client = await createWsClient(config);

        let ack, ackMsg;

        // subscribe client to channel
        ack = clientWait(client, 1);
        clientSend(client, { realm: "notif", action: "subscribe", channel: "1" });
        ackMsg = await ack;
        expect(ackMsg).toMatchObject({ body: { status: "success", action: "subscribe", channel: "1" } });

        // unsubscribe client from channel
        ack = clientWait(client, 1);
        clientSend(client, { realm: "notif", action: "unsubscribe", channel: "1" });
        ackMsg = await ack;
        expect(ackMsg).toMatchObject({ body: { status: "success", action: "unsubscribe", channel: "1" } });

        // expect next message to be ack for subscribing again, but NOT "you should not receive me"
        ack = clientWait(client, 1);
        server.websocketChannels.channelSend("1", createPayloadMessage("you should not receive me"));

        // subscribe again client to channel
        clientSend(client, { realm: "notif", action: "subscribe", channel: "1" });
        ackMsg = await ack;
        expect(ackMsg).not.toMatchObject({
            body: "you should not receive me",
        });
        expect(ackMsg).toMatchObject({ body: { status: "success", action: "subscribe", channel: "1" } });

        // now next message should be "hello again"
        const waitMsg = clientWait(client, 1);
        server.websocketChannels.channelSend("1", createPayloadMessage("hello again"));
        const data = await waitMsg;

        expect(data).not.toMatchObject({
            body: "you should not receive me",
        });

        expect(data).toStrictEqual({
            realm: "notif",
            body: "hello again",
        });

        client.close();
        await server.close();
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
        let ack;

        // spawn 5 clients and sub them to channel 1
        testEnv.subs1 = await createWsClients(config, numClients);
        ack = clientsWait(testEnv.subs1, 1);
        testEnv.subs1.forEach(client => clientSend(client, { realm: "notif", action: "subscribe", channel: "1" }));
        await ack;

        // spawn 5 clients and sub them to channel 2
        testEnv.subs2 = await createWsClients(config, numClients);
        ack = clientsWait(testEnv.subs2, 1);
        testEnv.subs2.forEach(client => clientSend(client, { realm: "notif", action: "subscribe", channel: "2" }));
        await ack;

        // spawn 5 clients and don't sub them
        testEnv.unsubs = await createWsClients(config, numClients);
    });

    test("Clients subscribed to channel '1' all receive 'msg1'", async () => {
        const msg = createPayloadMessage('msg1');
        const test = clientsWait(testEnv.subs1!, 1);
        testEnv.server!.websocketChannels.channelSend('1', msg);
        const data = await test;
        data.forEach(value => expect(value).toStrictEqual(msg));
    });

    test("Clients subscribed to channel '2' all receive 'msg2", async () => {
        const msg = createPayloadMessage('msg2');
        const test = clientsWait(testEnv.subs2!, 1);
        testEnv.server!.websocketChannels.channelSend('2', msg);
        const data = await test;
        data.forEach(value => expect(value).toStrictEqual(msg));
    });

    test("Clients subscribed to channel '2' all receive 'hello2' but not 'hello1' sent to channel '1'", async () => {
        const hello2 = createPayloadMessage('hello2');
        const hello1 = createPayloadMessage('hello1');
        const test1 = clientsWait(testEnv.subs1!, 1);
        const test2 = clientsWait(testEnv.subs2!, 1);
        testEnv.server!.websocketChannels.channelSend('1', hello1);
        testEnv.server!.websocketChannels.channelSend('2', hello2);
        const data1 = await test1;
        const data2 = await test2;
        data1.forEach(value => expect(value).toStrictEqual(hello1));
        data2.forEach(value => expect(value).toStrictEqual(hello2));
    });

    test("All clients receive broadcasts even if not subscribed to channels", async () => {
        const broadcastMsg = createPayloadMessage({ hello: "world" });
        const clientsShouldReceive = new Array<WebSocket>().concat(testEnv.subs1!, testEnv.subs2!, testEnv.unsubs!);
        const test = clientsWait(clientsShouldReceive, 1);
        testEnv.server!.websocketChannels.broadcast(broadcastMsg);
        const data = await test;
        data.forEach(value => expect(value).toStrictEqual(broadcastMsg));
    });


    afterAll(async () => {
        testEnv.subs1!.forEach(client => client.close());
        testEnv.subs2!.forEach(client => client.close());
        testEnv.unsubs!.forEach(client => client.close());
        await testEnv.server!.close();
    });
});
