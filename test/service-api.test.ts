/**
 * graasp-websockets
 *
 * Tests for {@link service-api.ts}
 *
 * @author Alexandre CHAU
 */

/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { FastifyInstance, FastifyLoggerInstance } from 'fastify';
import { Item, ItemMembership } from 'graasp';
import waitForExpect from 'wait-for-expect';
import WebSocket from 'ws';
import {
  WS_CLIENT_ACTION_DISCONNECT,
  WS_CLIENT_ACTION_SUBSCRIBE,
  WS_CLIENT_ACTION_SUBSCRIBE_ONLY,
  WS_CLIENT_ACTION_UNSUBSCRIBE,
  WS_ENTITY_ITEM,
  WS_ENTITY_MEMBER,
  WS_REALM_NOTIF,
  WS_RESPONSE_STATUS_ERROR,
  WS_RESPONSE_STATUS_SUCCESS,
  WS_SERVER_ERROR_ACCESS_DENIED,
  WS_SERVER_ERROR_GENERIC,
  WS_SERVER_ERROR_INVALID_REQUEST,
  WS_SERVER_ERROR_NOT_FOUND,
  WS_SERVER_TYPE_INFO,
  WS_SERVER_TYPE_RESPONSE,
  WS_SERVER_TYPE_UPDATE,
  WS_UPDATE_KIND_CHILD_ITEM,
  WS_UPDATE_KIND_SHARED_WITH,
  WS_UPDATE_OP_CREATE,
  WS_UPDATE_OP_DELETE,
} from '../src/interfaces/constants';
import { ClientMessage, createServerInfo } from '../src/interfaces/message';
import {
  createMockFastifyLogger,
  createMockItem,
  createMockItemMembership,
  mockItemMembershipsManager,
  mockItemsManager,
  mockTaskRunner,
} from './mocks';
import {
  clientSend,
  clientsWait,
  clientWait,
  createDefaultLocalConfig,
  createWsClient,
  createWsClients,
  createWsFastifyInstance,
  PortGenerator,
  TestConfig,
} from './test-utils';

const portGen = new PortGenerator(7000);

afterEach(() => {
  // make sure that stateful mocks are cleared
  mockTaskRunner.clearHandlers();
});

test('Prefix option is used if present, otherwise default is used', async () => {
  const configWithPrefix: TestConfig = {
    host: '127.0.0.1',
    port: portGen.getNewPort(),
    prefix: '/testPrefix',
  };
  const serverWithPrefix = await createWsFastifyInstance(configWithPrefix);
  const clientWithPrefix = await createWsClient(configWithPrefix);
  const res1 = new Promise((resolve) => clientWithPrefix.on('pong', resolve));
  clientWithPrefix.ping('withPrefix');
  expect(((await res1) as Buffer).toString()).toStrictEqual('withPrefix');

  const configNoPrefix: TestConfig = {
    host: '127.0.0.1',
    port: portGen.getNewPort(),
  };
  const serverNoPrefix = await createWsFastifyInstance(configNoPrefix);
  const clientNoPrefix = await createWsClient(configNoPrefix);
  const res2 = new Promise((resolve) => clientNoPrefix.on('pong', resolve));
  clientNoPrefix.ping('noPrefix');
  expect(((await res2) as Buffer).toString()).toStrictEqual('noPrefix');

  clientWithPrefix.close();
  serverWithPrefix.close();
  clientNoPrefix.close();
  serverNoPrefix.close();
});

test('Client connecting to server is registered and then removed on close', async () => {
  const config = createDefaultLocalConfig({ port: portGen.getNewPort() });
  const server = await createWsFastifyInstance(config);
  const client = await createWsClient(config);
  expect(server.websocketChannels!.subscriptions.size).toEqual(1);
  client.close();
  await waitForExpect(() => {
    expect(server.websocketChannels!.subscriptions.size).toEqual(0);
  });
  await server.close();
});

test('Client sending a disconnect message is removed', async () => {
  const config = createDefaultLocalConfig({ port: portGen.getNewPort() });
  const server = await createWsFastifyInstance(config);
  const client = await createWsClient(config);
  expect(server.websocketChannels!.subscriptions.size).toEqual(1);
  clientSend(client, {
    realm: WS_REALM_NOTIF,
    action: WS_CLIENT_ACTION_DISCONNECT,
  });
  await waitForExpect(() => {
    expect(server.websocketChannels!.subscriptions.size).toEqual(0);
  });
  client.close();
  await server.close();
});

test('Channel with removeIfEmpty is removed when its last subscriber unsubscribes from it', async () => {
  const config = createDefaultLocalConfig({ port: portGen.getNewPort() });
  const server = await createWsFastifyInstance(config);
  server.websocketChannels!.channelCreate('a', true);
  const client = await createWsClient(config);

  // subscribe to channel "a" and await ack
  const ack = clientWait(client, 1);
  const request: ClientMessage = {
    realm: WS_REALM_NOTIF,
    action: WS_CLIENT_ACTION_SUBSCRIBE,
    channel: 'a',
    entity: WS_ENTITY_ITEM,
  };
  clientSend(client, request);
  const ackMsg = await ack;
  expect(ackMsg).toStrictEqual({
    realm: WS_REALM_NOTIF,
    type: WS_SERVER_TYPE_RESPONSE,
    status: WS_RESPONSE_STATUS_SUCCESS,
    request,
  });
  expect(server.websocketChannels!.channels.get('a')?.subscribers.size).toEqual(
    1,
  );

  // unsubscribe from channel "a" and await ack
  const ack2 = clientWait(client, 1);
  const request2: ClientMessage = {
    realm: WS_REALM_NOTIF,
    action: WS_CLIENT_ACTION_UNSUBSCRIBE,
    channel: 'a',
  };
  clientSend(client, request2);
  const ack2Msg = await ack2;
  expect(ack2Msg).toStrictEqual({
    realm: WS_REALM_NOTIF,
    type: WS_SERVER_TYPE_RESPONSE,
    status: WS_RESPONSE_STATUS_SUCCESS,
    request: request2,
  });
  expect(server.websocketChannels!.channels.get('a')).toBeUndefined();

  client.close();
  server.close();
});

test('Client that is removed is also deleted from channel subscribers', async () => {
  const config = createDefaultLocalConfig({ port: portGen.getNewPort() });
  const server = await createWsFastifyInstance(config);
  server.websocketChannels!.channelCreate('a', false);
  const client = await createWsClient(config);

  // subscribe to channel "a" and await ack
  const ack = clientWait(client, 1);
  const req: ClientMessage = {
    realm: WS_REALM_NOTIF,
    action: WS_CLIENT_ACTION_SUBSCRIBE,
    channel: 'a',
    entity: WS_ENTITY_ITEM,
  };
  clientSend(client, req);
  const ackMsg = await ack;
  expect(ackMsg).toStrictEqual({
    realm: WS_REALM_NOTIF,
    type: WS_SERVER_TYPE_RESPONSE,
    status: WS_RESPONSE_STATUS_SUCCESS,
    request: req,
  });
  expect(server.websocketChannels!.channels.get('a')?.subscribers.size).toEqual(
    1,
  );

  client.close();
  await waitForExpect(() => {
    // after client closed, channels should not see it as subscriber anymore
    expect(
      server.websocketChannels!.channels.get('a')?.subscribers.size,
    ).toEqual(0);
  });
  await server.close();
});

test('Removing a channel with subscribers removes subscription from them', async () => {
  const config = createDefaultLocalConfig({ port: portGen.getNewPort() });
  const server = await createWsFastifyInstance(config);
  server.websocketChannels!.channelCreate('a', false);
  const client = await createWsClient(config);

  // subscribe to channel "a" and await ack
  const ack = clientWait(client, 1);
  const req: ClientMessage = {
    realm: WS_REALM_NOTIF,
    action: WS_CLIENT_ACTION_SUBSCRIBE,
    channel: 'a',
    entity: WS_ENTITY_ITEM,
  };
  clientSend(client, req);
  const ackMsg = await ack;
  expect(ackMsg).toStrictEqual({
    realm: WS_REALM_NOTIF,
    type: WS_SERVER_TYPE_RESPONSE,
    status: WS_RESPONSE_STATUS_SUCCESS,
    request: req,
  });
  expect(server.websocketChannels!.channels.get('a')?.subscribers.size).toEqual(
    1,
  );

  server.websocketChannels!.subscriptions.forEach((client) => {
    expect(client.subscriptions.size).toEqual(1);
  });

  server.websocketChannels!.channelDelete('a');

  server.websocketChannels!.subscriptions.forEach((client) => {
    expect(client.subscriptions.size).toEqual(0);
  });

  client.close();
  await server.close();
});

describe('Client requests are handled', () => {
  const testEnv: Partial<{
    config: TestConfig;
    server: FastifyInstance;
  }> = {};

  beforeAll(async () => {
    testEnv.config = createDefaultLocalConfig({ port: portGen.getNewPort() });
    testEnv.server = await createWsFastifyInstance(testEnv.config);
    testEnv.server.websocketChannels!.channelCreate('1', false);
  });

  test('Client sending an ill-formed request receives an error message', async () => {
    const msg = { wrong: 'format' };
    const client = await createWsClient(testEnv.config!);
    const response = clientWait(client, 1);
    client.send(JSON.stringify(msg));
    const data = await response;
    expect(data).toStrictEqual({
      realm: WS_REALM_NOTIF,
      status: WS_RESPONSE_STATUS_ERROR,
      type: WS_SERVER_TYPE_RESPONSE,
      error: {
        name: WS_SERVER_ERROR_INVALID_REQUEST,
        message: 'Request message format was not understood by the server',
      },
    });
    client.close();
  });

  test('Client using subscribeOnly on multiple channels only receives from last', async () => {
    const config = createDefaultLocalConfig({ port: portGen.getNewPort() });
    const server = await createWsFastifyInstance(config);
    server.websocketChannels!.channelCreate('1', false);
    server.websocketChannels!.channelCreate('2', false);
    server.websocketChannels!.channelCreate('3', false);
    server.websocketChannels!.channelCreate('4', false);

    // subscribe only 4 times in a row to 4 channels
    const client = await createWsClient(config);
    const acks = clientWait(client, 4);
    clientSend(client, {
      realm: WS_REALM_NOTIF,
      action: WS_CLIENT_ACTION_SUBSCRIBE_ONLY,
      channel: '1',
      entity: WS_ENTITY_ITEM,
    });
    clientSend(client, {
      realm: WS_REALM_NOTIF,
      action: WS_CLIENT_ACTION_SUBSCRIBE_ONLY,
      channel: '2',
      entity: WS_ENTITY_ITEM,
    });
    clientSend(client, {
      realm: WS_REALM_NOTIF,
      action: WS_CLIENT_ACTION_SUBSCRIBE_ONLY,
      channel: '3',
      entity: WS_ENTITY_ITEM,
    });
    clientSend(client, {
      realm: WS_REALM_NOTIF,
      action: WS_CLIENT_ACTION_SUBSCRIBE_ONLY,
      channel: '4',
      entity: WS_ENTITY_ITEM,
    });
    const ackMsgs = await acks;
    const expectedAckMsgs = ['1', '2', '3', '4'].map((c) => ({
      realm: WS_REALM_NOTIF,
      type: WS_SERVER_TYPE_RESPONSE,
      status: WS_RESPONSE_STATUS_SUCCESS,
      request: {
        realm: WS_REALM_NOTIF,
        action: WS_CLIENT_ACTION_SUBSCRIBE_ONLY,
        channel: c,
        entity: WS_ENTITY_ITEM,
      },
    }));
    expect(ackMsgs).toStrictEqual(expectedAckMsgs);

    // wait for a single message: should only received from channel "4"
    const waitMsg = clientWait(client, 1);
    server.websocketChannels!.channelSend('1', createServerInfo('hello1'));
    server.websocketChannels!.channelSend('2', createServerInfo('hello2'));
    server.websocketChannels!.channelSend('3', createServerInfo('hello3'));
    server.websocketChannels!.channelSend('4', createServerInfo('hello4'));
    const data = await waitMsg;
    expect(data).toStrictEqual({
      realm: WS_REALM_NOTIF,
      type: WS_SERVER_TYPE_INFO,
      message: 'hello4',
    });

    client.close();
    await server.close();
  });

  test('Client unsubscribing from a channel does not receive messages anymore', async () => {
    const config = createDefaultLocalConfig({ port: portGen.getNewPort() });
    const server = await createWsFastifyInstance(config);
    server.websocketChannels!.channelCreate('1', false);
    const client = await createWsClient(config);

    let ack, ackMsg;
    let req: ClientMessage;

    // subscribe client to channel
    req = {
      realm: WS_REALM_NOTIF,
      action: WS_CLIENT_ACTION_SUBSCRIBE,
      channel: '1',
      entity: WS_ENTITY_ITEM,
    };
    ack = clientWait(client, 1);
    clientSend(client, req);
    ackMsg = await ack;
    expect(ackMsg).toStrictEqual({
      realm: WS_REALM_NOTIF,
      type: WS_SERVER_TYPE_RESPONSE,
      status: WS_RESPONSE_STATUS_SUCCESS,
      request: req,
    });

    // unsubscribe client from channel
    ack = clientWait(client, 1);
    req = {
      realm: WS_REALM_NOTIF,
      action: WS_CLIENT_ACTION_UNSUBSCRIBE,
      channel: '1',
    };
    clientSend(client, req);
    ackMsg = await ack;
    expect(ackMsg).toStrictEqual({
      realm: WS_REALM_NOTIF,
      type: WS_SERVER_TYPE_RESPONSE,
      status: WS_RESPONSE_STATUS_SUCCESS,
      request: req,
    });

    // expect next message to be ack for subscribing again, but NOT "you should not receive me"
    ack = clientWait(client, 1);
    server.websocketChannels!.channelSend(
      '1',
      createServerInfo('you should not receive me'),
    );

    // subscribe again client to channel
    req = {
      realm: WS_REALM_NOTIF,
      action: WS_CLIENT_ACTION_SUBSCRIBE,
      channel: '1',
      entity: WS_ENTITY_ITEM,
    };
    clientSend(client, req);
    ackMsg = await ack;
    expect(ackMsg).not.toMatchObject({
      message: 'you should not receive me',
    });
    expect(ackMsg).toStrictEqual({
      realm: WS_REALM_NOTIF,
      type: WS_SERVER_TYPE_RESPONSE,
      status: WS_RESPONSE_STATUS_SUCCESS,
      request: req,
    });

    // now next message should be "hello again"
    const waitMsg = clientWait(client, 1);
    server.websocketChannels!.channelSend('1', createServerInfo('hello again'));
    const data = await waitMsg;

    expect(data).not.toMatchObject({
      body: 'you should not receive me',
    });

    expect(data).toStrictEqual({
      realm: WS_REALM_NOTIF,
      type: WS_SERVER_TYPE_INFO,
      message: 'hello again',
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
    server: FastifyInstance;
    subs1: Array<WebSocket>;
    subs2: Array<WebSocket>;
    unsubs: Array<WebSocket>;
  }> = {};

  beforeAll(async () => {
    const config = createDefaultLocalConfig({ port: portGen.getNewPort() });

    testEnv.server = await createWsFastifyInstance(config);

    // create some channels
    const channels = testEnv.server.websocketChannels;
    channels!.channelCreate('1', false);
    channels!.channelCreate('2', false);

    const numClients = 5;
    let ack;

    // spawn 5 clients and sub them to channel 1
    testEnv.subs1 = await createWsClients(config, numClients);
    ack = clientsWait(testEnv.subs1, 1);
    testEnv.subs1.forEach((client) =>
      clientSend(client, {
        realm: WS_REALM_NOTIF,
        action: WS_CLIENT_ACTION_SUBSCRIBE,
        channel: '1',
        entity: WS_ENTITY_ITEM,
      }),
    );
    await ack;

    // spawn 5 clients and sub them to channel 2
    testEnv.subs2 = await createWsClients(config, numClients);
    ack = clientsWait(testEnv.subs2, 1);
    testEnv.subs2.forEach((client) =>
      clientSend(client, {
        realm: WS_REALM_NOTIF,
        action: WS_CLIENT_ACTION_SUBSCRIBE,
        channel: '2',
        entity: WS_ENTITY_ITEM,
      }),
    );
    await ack;

    // spawn 5 clients and don't sub them
    testEnv.unsubs = await createWsClients(config, numClients);
  });

  test("Clients subscribed to channel '1' all receive 'msg1'", async () => {
    const msg = createServerInfo('msg1');
    const test = clientsWait(testEnv.subs1!, 1);
    delete msg.extra;
    testEnv.server!.websocketChannels!.channelSend('1', msg);
    const data = await test;
    data.forEach((value) => expect(value).toStrictEqual(msg));
  });

  test("Clients subscribed to channel '2' all receive 'msg2", async () => {
    const msg = createServerInfo('msg2');
    const test = clientsWait(testEnv.subs2!, 1);
    delete msg.extra;
    testEnv.server!.websocketChannels!.channelSend('2', msg);
    const data = await test;
    data.forEach((value) => expect(value).toStrictEqual(msg));
  });

  test("Clients subscribed to channel '2' all receive 'hello2' but not 'hello1' sent to channel '1'", async () => {
    const hello2 = createServerInfo('hello2');
    delete hello2.extra;
    const hello1 = createServerInfo('hello1');
    delete hello1.extra;
    const test1 = clientsWait(testEnv.subs1!, 1);
    const test2 = clientsWait(testEnv.subs2!, 1);
    testEnv.server!.websocketChannels!.channelSend('1', hello1);
    testEnv.server!.websocketChannels!.channelSend('2', hello2);
    const data1 = await test1;
    const data2 = await test2;
    data1.forEach((value) => expect(value).toStrictEqual(hello1));
    data2.forEach((value) => expect(value).toStrictEqual(hello2));
  });

  test('All clients receive broadcasts even if not subscribed to channels', async () => {
    const broadcastMsg = createServerInfo('hello world');
    delete broadcastMsg.extra;
    const clientsShouldReceive = new Array<WebSocket>().concat(
      testEnv.subs1!,
      testEnv.subs2!,
      testEnv.unsubs!,
    );
    const test = clientsWait(clientsShouldReceive, 1);
    testEnv.server!.websocketChannels!.broadcast(broadcastMsg);
    const data = await test;
    data.forEach((value) => expect(value).toStrictEqual(broadcastMsg));
  });

  afterAll(async () => {
    testEnv.subs1!.forEach((client) => client.close());
    testEnv.subs2!.forEach((client) => client.close());
    testEnv.unsubs!.forEach((client) => client.close());
    await testEnv.server!.close();
  });
});

describe('Graasp-specific behaviour', () => {
  test('Creating an item with a parent triggers notification on parent channel', async () => {
    const config = createDefaultLocalConfig({ port: portGen.getNewPort() });
    const server = await createWsFastifyInstance(config);
    const client = await createWsClient(config);

    const ack = clientWait(client, 1);
    const req: ClientMessage = {
      realm: WS_REALM_NOTIF,
      action: WS_CLIENT_ACTION_SUBSCRIBE,
      channel: 'parent',
      entity: WS_ENTITY_ITEM,
    };
    clientSend(client, req);
    expect(await ack).toStrictEqual({
      realm: WS_REALM_NOTIF,
      type: WS_SERVER_TYPE_RESPONSE,
      status: WS_RESPONSE_STATUS_SUCCESS,
      request: req,
    });

    // expect next message to be parent notif
    const notif = clientWait(client, 1);
    // simulate create child event on task runner
    const newChildItem: Item = createMockItem();
    newChildItem.path = 'parent.child';
    newChildItem.extra = { foo: 'bar' };
    await mockTaskRunner.runPost(
      mockItemsManager.taskManager.getCreateTaskName(),
      newChildItem,
    );
    expect(await notif).toStrictEqual({
      realm: WS_REALM_NOTIF,
      type: WS_SERVER_TYPE_UPDATE,
      channel: 'parent',
      body: {
        entity: WS_ENTITY_ITEM,
        kind: WS_UPDATE_KIND_CHILD_ITEM,
        op: WS_UPDATE_OP_CREATE,
        value: newChildItem,
      },
    });

    client.close();
    server.close();
  });

  test('Deleting an item with a parent triggers notification on parent channel', async () => {
    const config = createDefaultLocalConfig({ port: portGen.getNewPort() });
    const server = await createWsFastifyInstance(config);
    const client = await createWsClient(config);

    const ack = clientWait(client, 1);
    const req: ClientMessage = {
      realm: WS_REALM_NOTIF,
      action: WS_CLIENT_ACTION_SUBSCRIBE,
      channel: 'parent',
      entity: WS_ENTITY_ITEM,
    };
    clientSend(client, req);
    expect(await ack).toStrictEqual({
      realm: WS_REALM_NOTIF,
      type: WS_SERVER_TYPE_RESPONSE,
      status: WS_RESPONSE_STATUS_SUCCESS,
      request: req,
    });

    // expect next message to be parent notif
    const notif = clientWait(client, 1);
    // simulate delete child event on task runner
    const deletedChildItem: Item = createMockItem();
    deletedChildItem.path = 'parent.child';
    deletedChildItem.extra = { foo: 'bar' };
    await mockTaskRunner.runPost(
      mockItemsManager.taskManager.getDeleteTaskName(),
      deletedChildItem,
    );
    expect(await notif).toStrictEqual({
      realm: WS_REALM_NOTIF,
      type: WS_SERVER_TYPE_UPDATE,
      channel: 'parent',
      body: {
        entity: WS_ENTITY_ITEM,
        kind: WS_UPDATE_KIND_CHILD_ITEM,
        op: WS_UPDATE_OP_DELETE,
        value: deletedChildItem,
      },
    });

    client.close();
    server.close();
  });

  test('Creating an item membership triggers notification on member channel', async () => {
    const config = createDefaultLocalConfig({ port: portGen.getNewPort() });
    const server = await createWsFastifyInstance(config);
    const client = await createWsClient(config);

    const ack = clientWait(client, 1);
    const req: ClientMessage = {
      realm: WS_REALM_NOTIF,
      action: WS_CLIENT_ACTION_SUBSCRIBE,
      channel: 'mockMemberId',
      entity: WS_ENTITY_MEMBER,
    };
    clientSend(client, req);
    expect(await ack).toStrictEqual({
      realm: WS_REALM_NOTIF,
      type: WS_SERVER_TYPE_RESPONSE,
      status: WS_RESPONSE_STATUS_SUCCESS,
      request: req,
    });

    // expect next message to be parent notif
    const notif = clientWait(client, 1);
    // simulate create item membership on task runner
    const newMembership: ItemMembership = createMockItemMembership();
    newMembership.memberId = 'mockMemberId';
    await mockTaskRunner.runPost(
      mockItemMembershipsManager.taskManager.getCreateTaskName(),
      newMembership,
    );
    // expected object is mock item created in mocks.ts
    const mockItem = createMockItem();
    expect(await notif).toStrictEqual({
      realm: WS_REALM_NOTIF,
      type: WS_SERVER_TYPE_UPDATE,
      channel: 'mockMemberId',
      body: {
        entity: WS_ENTITY_MEMBER,
        kind: WS_UPDATE_KIND_SHARED_WITH,
        op: WS_UPDATE_OP_CREATE,
        value: mockItem,
      },
    });

    client.close();
    server.close();
  });

  test('Client using subscribeOnly after subscribe on 2 channels only receives from last', async () => {
    const config = createDefaultLocalConfig({ port: portGen.getNewPort() });
    const server = await createWsFastifyInstance(config);
    const client = await createWsClient(config);

    // subscribe to first channel
    const ack1 = clientWait(client, 1);
    const req1: ClientMessage = {
      realm: WS_REALM_NOTIF,
      action: WS_CLIENT_ACTION_SUBSCRIBE,
      channel: 'parent1',
      entity: WS_ENTITY_ITEM,
    };
    clientSend(client, req1);
    expect(await ack1).toStrictEqual({
      realm: WS_REALM_NOTIF,
      type: WS_SERVER_TYPE_RESPONSE,
      status: WS_RESPONSE_STATUS_SUCCESS,
      request: req1,
    });

    // subscribe ONLY to second channel
    const ack2 = clientWait(client, 1);
    const req2: ClientMessage = {
      realm: WS_REALM_NOTIF,
      action: WS_CLIENT_ACTION_SUBSCRIBE_ONLY,
      channel: 'parent2',
      entity: WS_ENTITY_ITEM,
    };
    clientSend(client, req2);
    expect(await ack2).toStrictEqual({
      realm: WS_REALM_NOTIF,
      type: WS_SERVER_TYPE_RESPONSE,
      status: WS_RESPONSE_STATUS_SUCCESS,
      request: req2,
    });

    // expect next message to be parent notif on channel 2 only
    const notif = clientWait(client, 1);

    // simulate create child event 1 on task runner
    const newChildItem1: Item = createMockItem();
    newChildItem1.path = 'parent1.child';
    newChildItem1.extra = { foo: 'bar1' };
    await mockTaskRunner.runPost(
      mockItemsManager.taskManager.getCreateTaskName(),
      newChildItem1,
    );

    // simulate create child event 2 on task runner
    const newChildItem2: Item = createMockItem();
    newChildItem2.path = 'parent2.child';
    newChildItem2.extra = { foo: 'bar2' };
    await mockTaskRunner.runPost(
      mockItemsManager.taskManager.getCreateTaskName(),
      newChildItem2,
    );

    // should only receive last notif
    expect(await notif).toStrictEqual({
      realm: WS_REALM_NOTIF,
      type: WS_SERVER_TYPE_UPDATE,
      channel: 'parent2',
      body: {
        entity: WS_ENTITY_ITEM,
        kind: WS_UPDATE_KIND_CHILD_ITEM,
        op: WS_UPDATE_OP_CREATE,
        value: newChildItem2,
      },
    });

    client.close();
    server.close();
  });

  describe('Erroneous cases are handled', () => {
    const testEnv: any = {};

    beforeEach(async () => {
      testEnv.config = createDefaultLocalConfig({ port: portGen.getNewPort() });
      testEnv.server = await createWsFastifyInstance(testEnv.config);
      testEnv.client = await createWsClient(testEnv.config);
    });

    test('Subscribing to a member channel that is not client itself is forbidden', async () => {
      const { client } = testEnv;

      const error = clientWait(client, 1);
      const req: ClientMessage = {
        realm: WS_REALM_NOTIF,
        action: WS_CLIENT_ACTION_SUBSCRIBE,
        channel: 'anotherMemberId',
        entity: WS_ENTITY_MEMBER,
      };
      clientSend(client, req);
      expect(await error).toStrictEqual({
        realm: WS_REALM_NOTIF,
        type: WS_SERVER_TYPE_RESPONSE,
        status: WS_RESPONSE_STATUS_ERROR,
        error: {
          name: WS_SERVER_ERROR_ACCESS_DENIED,
          message:
            'Unable to subscribe to channel anotherMemberId: user access denied for this channel',
        },
        request: req,
      });
    });

    test('Subscribing to an item that does not exist in database is forbidden', async () => {
      const { client } = testEnv;

      // setup mock to return null when db fetches invalid item
      (mockItemsManager.dbService.get as jest.Mock).mockReturnValueOnce(
        Promise.resolve(null),
      );
      const error = clientWait(client, 1);
      const req: ClientMessage = {
        realm: WS_REALM_NOTIF,
        action: WS_CLIENT_ACTION_SUBSCRIBE,
        channel: 'someInvalidItemId',
        entity: WS_ENTITY_ITEM,
      };
      clientSend(client, req);
      expect(await error).toStrictEqual({
        realm: WS_REALM_NOTIF,
        type: WS_SERVER_TYPE_RESPONSE,
        status: WS_RESPONSE_STATUS_ERROR,
        error: {
          name: WS_SERVER_ERROR_NOT_FOUND,
          message:
            'Unable to subscribe to channel someInvalidItemId: user or channel not found',
        },
        request: req,
      });
    });

    test('Subscribing to an item which user does not have access to is forbidden', async () => {
      const { client } = testEnv;

      // setup mock to return false when permission is checked
      (
        mockItemMembershipsManager.dbService.canRead as jest.Mock
      ).mockReturnValueOnce(Promise.resolve(false));
      const error = clientWait(client, 1);
      const req: ClientMessage = {
        realm: WS_REALM_NOTIF,
        action: WS_CLIENT_ACTION_SUBSCRIBE,
        channel: 'someUnauthorizedItem',
        entity: WS_ENTITY_ITEM,
      };
      clientSend(client, req);
      expect(await error).toStrictEqual({
        realm: WS_REALM_NOTIF,
        type: WS_SERVER_TYPE_RESPONSE,
        status: WS_RESPONSE_STATUS_ERROR,
        error: {
          name: WS_SERVER_ERROR_ACCESS_DENIED,
          message:
            'Unable to subscribe to channel someUnauthorizedItem: user access denied for this channel',
        },
        request: req,
      });
    });

    test('Subscribing ONLY to a member channel that is not client itself is forbidden', async () => {
      const { client } = testEnv;

      const error = clientWait(client, 1);
      const req: ClientMessage = {
        realm: WS_REALM_NOTIF,
        action: WS_CLIENT_ACTION_SUBSCRIBE_ONLY,
        channel: 'anotherMemberId',
        entity: WS_ENTITY_MEMBER,
      };
      clientSend(client, req);
      expect(await error).toStrictEqual({
        realm: WS_REALM_NOTIF,
        type: WS_SERVER_TYPE_RESPONSE,
        status: WS_RESPONSE_STATUS_ERROR,
        error: {
          name: WS_SERVER_ERROR_ACCESS_DENIED,
          message:
            'Unable to subscribe to channel anotherMemberId: user access denied for this channel',
        },
        request: req,
      });
    });

    test('Subscribing ONLY to an item that does not exist in database is forbidden', async () => {
      const { client } = testEnv;

      // setup mock to return null when db fetches invalid item
      (mockItemsManager.dbService.get as jest.Mock).mockReturnValueOnce(
        Promise.resolve(null),
      );
      const error = clientWait(client, 1);
      const req: ClientMessage = {
        realm: WS_REALM_NOTIF,
        action: WS_CLIENT_ACTION_SUBSCRIBE_ONLY,
        channel: 'someInvalidItemId',
        entity: WS_ENTITY_ITEM,
      };
      clientSend(client, req);
      expect(await error).toStrictEqual({
        realm: WS_REALM_NOTIF,
        type: WS_SERVER_TYPE_RESPONSE,
        status: WS_RESPONSE_STATUS_ERROR,
        error: {
          name: WS_SERVER_ERROR_NOT_FOUND,
          message:
            'Unable to subscribe to channel someInvalidItemId: user or channel not found',
        },
        request: req,
      });
    });

    test('Subscribing ONLY to an item which user does not have access to is forbidden', async () => {
      const { client } = testEnv;

      // setup mock to return false when permission is checked
      (
        mockItemMembershipsManager.dbService.canRead as jest.Mock
      ).mockReturnValueOnce(Promise.resolve(false));
      const error = clientWait(client, 1);
      const req: ClientMessage = {
        realm: WS_REALM_NOTIF,
        action: WS_CLIENT_ACTION_SUBSCRIBE_ONLY,
        channel: 'someUnauthorizedItem',
        entity: WS_ENTITY_ITEM,
      };
      clientSend(client, req);
      expect(await error).toStrictEqual({
        realm: WS_REALM_NOTIF,
        type: WS_SERVER_TYPE_RESPONSE,
        status: WS_RESPONSE_STATUS_ERROR,
        error: {
          name: WS_SERVER_ERROR_ACCESS_DENIED,
          message:
            'Unable to subscribe to channel someUnauthorizedItem: user access denied for this channel',
        },
        request: req,
      });
    });

    test("Subscribing to a channel when the user or channel doesn't exist anymore triggers not found error", async () => {
      const { server, client } = testEnv;

      // force flush users
      server.websocketChannels!.channels.clear();
      server.websocketChannels!.subscriptions.clear();

      const error = clientWait(client, 1);
      const req: ClientMessage = {
        realm: WS_REALM_NOTIF,
        action: WS_CLIENT_ACTION_SUBSCRIBE,
        channel: 'someItemId',
        entity: WS_ENTITY_ITEM,
      };
      clientSend(client, req);
      expect(await error).toStrictEqual({
        realm: WS_REALM_NOTIF,
        type: WS_SERVER_TYPE_RESPONSE,
        status: WS_RESPONSE_STATUS_ERROR,
        error: {
          name: WS_SERVER_ERROR_NOT_FOUND,
          message:
            'Unable to subscribe to channel someItemId: user or channel not found',
        },
        request: req,
      });
    });

    test("Subscribing ONLY to a channel when the user or channel doesn't exist anymore triggers not found error", async () => {
      const { server, client } = testEnv;

      // force flush users
      server.websocketChannels!.channels.clear();
      server.websocketChannels!.subscriptions.clear();

      const error = clientWait(client, 1);
      const req: ClientMessage = {
        realm: WS_REALM_NOTIF,
        action: WS_CLIENT_ACTION_SUBSCRIBE_ONLY,
        channel: 'someItemId',
        entity: WS_ENTITY_ITEM,
      };
      clientSend(client, req);
      expect(await error).toStrictEqual({
        realm: WS_REALM_NOTIF,
        type: WS_SERVER_TYPE_RESPONSE,
        status: WS_RESPONSE_STATUS_ERROR,
        error: {
          name: WS_SERVER_ERROR_NOT_FOUND,
          message:
            'Unable to subscribe to channel someItemId: user or channel not found',
        },
        request: req,
      });
    });

    test("Unsubscribing from a channel that doesn't exist triggers not found error", async () => {
      const { client } = testEnv;

      const error = clientWait(client, 1);
      const req: ClientMessage = {
        realm: WS_REALM_NOTIF,
        action: WS_CLIENT_ACTION_UNSUBSCRIBE,
        channel: 'someNonExistentItemId',
      };
      clientSend(client, req);
      expect(await error).toStrictEqual({
        realm: WS_REALM_NOTIF,
        type: WS_SERVER_TYPE_RESPONSE,
        status: WS_RESPONSE_STATUS_ERROR,
        error: {
          name: WS_SERVER_ERROR_NOT_FOUND,
          message:
            'Unable to subscribe to channel someNonExistentItemId: user or channel not found',
        },
        request: req,
      });
    });

    test('Database crash while fetching item triggers server error response', async () => {
      const { client } = testEnv;

      // setup mock to fail DB fetch and raise error by returning rejected error
      (mockItemsManager.dbService.get as jest.Mock).mockRejectedValueOnce(
        new Error('Mock DB error'),
      );
      const error = clientWait(client, 1);
      const req: ClientMessage = {
        realm: WS_REALM_NOTIF,
        action: WS_CLIENT_ACTION_SUBSCRIBE,
        channel: 'someItemId',
        entity: WS_ENTITY_ITEM,
      };
      clientSend(client, req);
      expect(await error).toStrictEqual({
        realm: WS_REALM_NOTIF,
        type: WS_SERVER_TYPE_RESPONSE,
        status: WS_RESPONSE_STATUS_ERROR,
        error: {
          name: WS_SERVER_ERROR_GENERIC,
          message: 'Database error',
        },
        request: req,
      });
    });

    test('Unexpected server error is caught by top-level error handler', async () => {
      const config = createDefaultLocalConfig({ port: portGen.getNewPort() });

      // setup logger with spy on error output, inject it into server
      const spiedLogger: FastifyLoggerInstance = createMockFastifyLogger();
      const logErrorSpy = jest.spyOn(spiedLogger, WS_RESPONSE_STATUS_ERROR);
      const server = await createWsFastifyInstance(config, async (instance) => {
        instance.log = spiedLogger;

        // simulate server error
        instance.addHook('preHandler', (req, res) => {
          throw new Error('Mock server error');
        });
      });

      const client = await createWsClient(config);

      const req = { some: 'invalid request' };
      client.send(JSON.stringify(req));

      await waitForExpect(() => {
        expect(logErrorSpy).toHaveBeenCalledWith(
          'graasp-websockets: an error occured: Error: Mock server error\n\tDestroying connection',
        );
      });

      client.close();
      server.close();
    });

    afterEach(async () => {
      const { client, server } = testEnv;
      client.close();
      server.close();
    });
  });
});
