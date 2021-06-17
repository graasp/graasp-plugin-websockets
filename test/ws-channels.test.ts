/**
 * graasp-websockets
 * 
 * Tests for {@link WebSocketChannels}
 * 
 * @author Alexandre CHAU
 */

/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { FastifyInstance } from 'fastify';
import { Item, ItemMembership } from 'graasp';
import waitForExpect from 'wait-for-expect';
import WebSocket from 'ws';
import { ClientMessage, createServerInfo } from '../src/interfaces/message';
import { createMockItem, createMockItemMembership, mockItemMembershipsManager, mockItemsManager, mockTaskRunner } from './mocks';
import { clientSend, clientsWait, clientWait, createDefaultLocalConfig, createWsChannels, createWsClient, createWsClients, createWsFastifyInstance, PortGenerator, TestConfig } from './test-utils';

const portGen = new PortGenerator(4000);

afterEach(() => {
    // make sure that stateful mocks are cleared
    mockTaskRunner.clearHandlers();
});

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
        const request: ClientMessage = { realm: "notif", action: "subscribe", channel: "a", entity: "item" };
        clientSend(client, request);
        const ackMsg = await ack;
        expect(ackMsg).toStrictEqual({
            realm: "notif",
            type: "response",
            status: "success",
            request,
        });
        expect(server.websocketChannels.channels.get('a')?.subscribers.size).toEqual(1);

        // unsubscribe from channel "a" and await ack
        const ack2 = clientWait(client, 1);
        const request2: ClientMessage = { realm: "notif", action: "unsubscribe", channel: "a" };
        clientSend(client, request2);
        const ack2Msg = await ack2;
        expect(ack2Msg).toStrictEqual({
            realm: "notif",
            type: "response",
            status: "success",
            request: request2,
        });
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
        const req: ClientMessage = { realm: "notif", action: "subscribe", channel: "a", entity: "item" };
        clientSend(client, req);
        const ackMsg = await ack;
        expect(ackMsg).toStrictEqual({
            realm: "notif",
            type: "response",
            status: "success",
            request: req,
        });
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
        const req: ClientMessage = { realm: "notif", action: "subscribe", channel: "a", entity: "item" };
        clientSend(client, req);
        const ackMsg = await ack;
        expect(ackMsg).toStrictEqual({
            realm: "notif",
            type: "response",
            status: "success",
            request: req,
        });
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
            status: "error",
            type: "response",
            error: {
                "name": "INVALID_REQUEST",
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
        clientSend(client, { realm: "notif", action: "subscribeOnly", channel: "1", entity: "item" });
        clientSend(client, { realm: "notif", action: "subscribeOnly", channel: "2", entity: "item" });
        clientSend(client, { realm: "notif", action: "subscribeOnly", channel: "3", entity: "item" });
        clientSend(client, { realm: "notif", action: "subscribeOnly", channel: "4", entity: "item" });
        const ackMsgs = await acks;
        const expectedAckMsgs = ["1", "2", "3", "4"].map(c => ({
            realm: "notif",
            type: "response",
            status: "success",
            request: {
                realm: "notif",
                action: "subscribeOnly",
                channel: c,
                entity: "item"
            },
        }));
        expect(ackMsgs).toStrictEqual(expectedAckMsgs);

        // wait for a single message: should only received from channel "4"
        const waitMsg = clientWait(client, 1);
        server.websocketChannels.channelSend("1", createServerInfo("hello1"));
        server.websocketChannels.channelSend("2", createServerInfo("hello2"));
        server.websocketChannels.channelSend("3", createServerInfo("hello3"));
        server.websocketChannels.channelSend("4", createServerInfo("hello4"));
        const data = await waitMsg;
        expect(data).toStrictEqual({
            realm: "notif",
            type: "info",
            message: "hello4",
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
        let req: ClientMessage;

        // subscribe client to channel
        req = { realm: "notif", action: "subscribe", channel: "1", entity: "item" };
        ack = clientWait(client, 1);
        clientSend(client, req);
        ackMsg = await ack;
        expect(ackMsg).toStrictEqual({
            realm: "notif",
            type: "response",
            status: "success",
            request: req,
        });

        // unsubscribe client from channel
        ack = clientWait(client, 1);
        req = { realm: "notif", action: "unsubscribe", channel: "1" };
        clientSend(client, req);
        ackMsg = await ack;
        expect(ackMsg).toStrictEqual({
            realm: "notif",
            type: "response",
            status: "success",
            request: req,
        });

        // expect next message to be ack for subscribing again, but NOT "you should not receive me"
        ack = clientWait(client, 1);
        server.websocketChannels.channelSend("1", createServerInfo("you should not receive me"));

        // subscribe again client to channel
        req = { realm: "notif", action: "subscribe", channel: "1", entity: "item" };
        clientSend(client, req);
        ackMsg = await ack;
        expect(ackMsg).not.toMatchObject({
            message: "you should not receive me",
        });
        expect(ackMsg).toStrictEqual({
            realm: "notif",
            type: "response",
            status: "success",
            request: req,
        });

        // now next message should be "hello again"
        const waitMsg = clientWait(client, 1);
        server.websocketChannels.channelSend("1", createServerInfo("hello again"));
        const data = await waitMsg;

        expect(data).not.toMatchObject({
            body: "you should not receive me",
        });

        expect(data).toStrictEqual({
            realm: "notif",
            type: "info",
            message: "hello again",
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
        testEnv.subs1.forEach(client => clientSend(client, { realm: "notif", action: "subscribe", channel: "1", entity: "item" }));
        await ack;

        // spawn 5 clients and sub them to channel 2
        testEnv.subs2 = await createWsClients(config, numClients);
        ack = clientsWait(testEnv.subs2, 1);
        testEnv.subs2.forEach(client => clientSend(client, { realm: "notif", action: "subscribe", channel: "2", entity: "item" }));
        await ack;

        // spawn 5 clients and don't sub them
        testEnv.unsubs = await createWsClients(config, numClients);
    });

    test("Clients subscribed to channel '1' all receive 'msg1'", async () => {
        const msg = createServerInfo('msg1');
        const test = clientsWait(testEnv.subs1!, 1);
        delete msg.extra;
        testEnv.server!.websocketChannels.channelSend('1', msg);
        const data = await test;
        data.forEach(value => expect(value).toStrictEqual(msg));
    });

    test("Clients subscribed to channel '2' all receive 'msg2", async () => {
        const msg = createServerInfo('msg2');
        const test = clientsWait(testEnv.subs2!, 1);
        delete msg.extra;
        testEnv.server!.websocketChannels.channelSend('2', msg);
        const data = await test;
        data.forEach(value => expect(value).toStrictEqual(msg));
    });

    test("Clients subscribed to channel '2' all receive 'hello2' but not 'hello1' sent to channel '1'", async () => {
        const hello2 = createServerInfo('hello2');
        delete hello2.extra;
        const hello1 = createServerInfo('hello1');
        delete hello1.extra;
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
        const broadcastMsg = createServerInfo("hello world");
        delete broadcastMsg.extra;
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

describe('Graasp-specific behaviour', () => {
    test("Creating an item with a parent triggers notification on parent channel", async () => {
        const config = createDefaultLocalConfig({ port: portGen.getNewPort() });
        const server = await createWsFastifyInstance(config);
        const client = await createWsClient(config);

        const ack = clientWait(client, 1);
        const req: ClientMessage = { realm: "notif", action: "subscribe", channel: "parent", entity: "item" };
        clientSend(client, req);
        expect(await ack).toStrictEqual({
            realm: "notif",
            type: "response",
            status: "success",
            request: req,
        });

        // expect next message to be parent notif
        const notif = clientWait(client, 1);
        // simulate create child event on task runner
        const newChildItem: Item = createMockItem();
        newChildItem.path = "parent.child";
        newChildItem.extra = { foo: "bar" };
        await mockTaskRunner.runPost(mockItemsManager.taskManager.getCreateTaskName(), newChildItem);
        expect(await notif).toStrictEqual({
            realm: "notif",
            type: "update",
            channel: "parent",
            body: {
                entity: "item",
                kind: "childItem",
                op: "create",
                value: newChildItem,
            },
        });


        client.close();
        server.close();
    });

    test("Deleting an item with a parent triggers notification on parent channel", async () => {
        const config = createDefaultLocalConfig({ port: portGen.getNewPort() });
        const server = await createWsFastifyInstance(config);
        const client = await createWsClient(config);

        const ack = clientWait(client, 1);
        const req: ClientMessage = { realm: "notif", action: "subscribe", channel: "parent", entity: "item" };
        clientSend(client, req);
        expect(await ack).toStrictEqual({
            realm: "notif",
            type: "response",
            status: "success",
            request: req,
        });

        // expect next message to be parent notif
        const notif = clientWait(client, 1);
        // simulate delete child event on task runner
        const deletedChildItem: Item = createMockItem();
        deletedChildItem.path = "parent.child";
        deletedChildItem.extra = { foo: "bar" };
        await mockTaskRunner.runPost(mockItemsManager.taskManager.getDeleteTaskName(), deletedChildItem);
        expect(await notif).toStrictEqual({
            realm: "notif",
            type: "update",
            channel: "parent",
            body: {
                entity: "item",
                kind: "childItem",
                op: "delete",
                value: deletedChildItem,
            },
        });


        client.close();
        server.close();
    });

    test("Creating an item membership triggers notification on member channel", async () => {
        const config = createDefaultLocalConfig({ port: portGen.getNewPort() });
        const server = await createWsFastifyInstance(config);
        const client = await createWsClient(config);

        const ack = clientWait(client, 1);
        const req: ClientMessage = { realm: "notif", action: "subscribe", channel: "mockMemberId", entity: "member" };
        clientSend(client, req);
        expect(await ack).toStrictEqual({
            realm: "notif",
            type: "response",
            status: "success",
            request: req,
        });

        // expect next message to be parent notif
        const notif = clientWait(client, 1);
        // simulate create item membership on task runner
        const newMembership: ItemMembership = createMockItemMembership();
        newMembership.memberId = "mockMemberId";
        await mockTaskRunner.runPost(mockItemMembershipsManager.taskManager.getCreateTaskName(), newMembership);
        // expected object is mock item created in mocks.ts
        const mockItem = createMockItem();
        expect(await notif).toStrictEqual({
            realm: "notif",
            type: "update",
            channel: "mockMemberId",
            body: {
                entity: "member",
                kind: "sharedWith",
                op: "create",
                value: mockItem,
            },
        });


        client.close();
        server.close();
    });

    describe("Erroneous cases are handled", () => {
        test("Subscribing to a member channel that is not client itself is forbidden", async () => {
            const config = createDefaultLocalConfig({ port: portGen.getNewPort() });
            const server = await createWsFastifyInstance(config);
            const client = await createWsClient(config);

            const error = clientWait(client, 1);
            const req: ClientMessage = { realm: "notif", action: "subscribe", channel: "anotherMemberId", entity: "member" };
            clientSend(client, req);
            expect(await error).toStrictEqual({
                realm: "notif",
                type: "response",
                status: "error",
                error: {
                    name: "ACCESS_DENIED",
                    message: "Unable to subscribe to channel anotherMemberId: user access denied for this channel",
                },
                request: req,
            });

            client.close();
            server.close();
        });
    });
});