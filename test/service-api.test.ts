/**
 * graasp-websockets
 *
 * Tests for {@link service-api.ts}
 */

/* eslint-disable @typescript-eslint/no-non-null-assertion */
import waitForExpect from 'wait-for-expect';
import WebSocket from 'ws';

import { FastifyInstance, FastifyLoggerInstance } from 'fastify';

import { AccessDenied } from '../src';
import { ClientMessage, createServerInfo } from '../src/interfaces/message';
import { createMockFastifyLogger } from './mocks';
import {
  PortGenerator,
  TestConfig,
  clientSend,
  clientWait,
  clientsWait,
  createDefaultLocalConfig,
  createWsClient,
  createWsClients,
  createWsFastifyInstance,
} from './test-utils';

const portGen = new PortGenerator(7000);

describe('plugin options', () => {
  test('plugin logs on boot', async () => {
    const config: TestConfig = {
      host: '127.0.0.1',
      port: portGen.getNewPort(),
      prefix: '/some-prefix',
      redis: {
        config: {
          host: '127.0.0.1',
          port: 6379,
          username: 'default',
          password: 'redis-password',
        },
        channelName: 'redis-channel-name',
      },
    };

    const spiedLogger: FastifyLoggerInstance = createMockFastifyLogger();
    const logInfoSpy = jest.spyOn(spiedLogger, 'info');
    const server = await createWsFastifyInstance(config, async (instance) => {
      instance.log = spiedLogger;
    });

    await waitForExpect(() => {
      // password should not be logged
      expect(logInfoSpy).toHaveBeenCalledWith(
        "graasp-websockets: plugin booted with prefix /some-prefix and Redis parameters { config: { host: '127.0.0.1', port: 6379, username: 'default' }, notifChannel: 'redis-channel-name' }",
      );
    });

    await server.close();
  });

  test('route prefix', async () => {
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
});

describe('internal state', () => {
  const t: Partial<{
    config: TestConfig;
    server: FastifyInstance;
    client: WebSocket;
  }> = {};

  beforeEach(async () => {
    t.config = createDefaultLocalConfig({ port: portGen.getNewPort() });
    t.server = await createWsFastifyInstance(t.config);
    t.client = await createWsClient(t.config);
  });

  afterEach(async () => {
    t.client!.close();
    await t.server!.close();
  });

  test('client connection registered', async () => {
    expect(t.server!._debug_websocketsChannels.subscriptions.size).toEqual(1);
    t.client!.close();
    await waitForExpect(() => {
      expect(t.server!._debug_websocketsChannels.subscriptions.size).toEqual(0);
    });
  });

  describe('with channels', () => {
    beforeEach(async () => {
      // register a topic with validation
      t.server!.websockets!.register('foo', async (req) => {
        /* don't reject */
      });

      // subscribe to channel "a" and await ack
      const ack = clientWait(t.client!, 1);
      const request: ClientMessage = {
        realm: 'notif',
        action: 'subscribe',
        channel: 'a',
        topic: 'foo',
      };
      clientSend(t.client!, request);

      // eslint-disable-next-line jest/no-standalone-expect
      expect(await ack).toStrictEqual({
        realm: 'notif',
        type: 'response',
        status: 'success',
        request,
      });
      // eslint-disable-next-line jest/no-standalone-expect
      expect(
        t.server!._debug_websocketsChannels.channels.get('foo/a')?.subscribers
          .size,
      ).toEqual(1);
    });

    test('flagged channel removed when last subscriber leaves', async () => {
      // unsubscribe from channel "a" and await ack
      const ack2 = clientWait(t.client!, 1);
      const request2: ClientMessage = {
        realm: 'notif',
        action: 'unsubscribe',
        topic: 'foo',
        channel: 'a',
      };
      clientSend(t.client!, request2);
      expect(await ack2).toStrictEqual({
        realm: 'notif',
        type: 'response',
        status: 'success',
        request: request2,
      });
      expect(
        t.server!._debug_websocketsChannels.channels.get('foo/a'),
      ).toBeUndefined();
    });

    test('removed client also deleted from channel subscribers', async () => {
      t.client!.close();
      await waitForExpect(() => {
        // after client closed, channels should not see it as subscriber anymore
        expect(
          t.server!._debug_websocketsChannels.channels.get('foo/a')?.subscribers
            .size,
        ).toEqual(0);
      });
    });

    test('deleted channel with subscribers removes subscription from them', async () => {
      t.server!._debug_websocketsChannels.subscriptions.forEach((client) => {
        expect(client.subscriptions.size).toEqual(1);
      });

      t.server!._debug_websocketsChannels.channelDelete('foo/a');

      t.server!._debug_websocketsChannels.subscriptions.forEach((client) => {
        expect(client.subscriptions.size).toEqual(0);
      });
    });
  });
});

describe('client requests', () => {
  const t: Partial<{
    config: TestConfig;
    server: FastifyInstance;
    client: WebSocket;
  }> = {};

  beforeAll(async () => {
    t.config = createDefaultLocalConfig({ port: portGen.getNewPort() });
    t.server = await createWsFastifyInstance(t.config);
    t.client = await createWsClient(t.config);
    // register a topic with validation
    t.server!.websockets!.register('foo', async (req) => {
      /* don't reject */
    });
  });

  afterAll(async () => {
    await t.server!.close();
  });

  test('ill-formed request', async () => {
    const msg = { wrong: 'format' };
    const response = clientWait(t.client!, 1);
    t.client!.send(JSON.stringify(msg));
    expect(await response).toStrictEqual({
      realm: 'notif',
      status: 'error',
      type: 'response',
      error: {
        name: 'BAD_REQUEST',
        message: 'Request message format was not understood by the server',
      },
    });
  });

  test('subscribeOnly', async () => {
    // subscribe only 4 times in a row to 4 channels
    const acks = clientWait(t.client!, 4);
    const channels = ['1', '2', '3', '4'];
    channels.forEach((c) =>
      clientSend(t.client!, {
        realm: 'notif',
        action: 'subscribeOnly',
        channel: c,
        topic: 'foo',
      }),
    );
    const expectedAckMsgs = channels.map((c) => ({
      realm: 'notif',
      type: 'response',
      status: 'success',
      request: {
        realm: 'notif',
        action: 'subscribeOnly',
        channel: c,
        topic: 'foo',
      },
    }));
    expect(await acks).toStrictEqual(expectedAckMsgs);

    // wait for a single message: should only received from channel "4"
    const msg = clientWait(t.client!, 1);
    channels.forEach((c) =>
      t.server!._debug_websocketsChannels.channelSend(
        'foo/' + c,
        createServerInfo('hello' + c),
      ),
    );
    expect(await msg).toStrictEqual({
      realm: 'notif',
      type: 'info',
      message: 'hello4',
    });
  });

  test('unsubscribe', async () => {
    let ack;
    let req: ClientMessage;

    // subscribe client to channel 1
    req = {
      realm: 'notif',
      action: 'subscribe',
      channel: '1',
      topic: 'foo',
    };
    ack = clientWait(t.client!, 1);
    clientSend(t.client!, req);
    expect(await ack).toStrictEqual({
      realm: 'notif',
      type: 'response',
      status: 'success',
      request: req,
    });

    // unsubscribe client from channel 1
    ack = clientWait(t.client!, 1);
    req = {
      realm: 'notif',
      action: 'unsubscribe',
      topic: 'foo',
      channel: '1',
    };
    clientSend(t.client!, req);
    expect(await ack).toStrictEqual({
      realm: 'notif',
      type: 'response',
      status: 'success',
      request: req,
    });

    // expect next message to be ack for subscribing again
    // but NOT "you should not receive me"
    ack = clientWait(t.client!, 1);
    t.server!._debug_websocketsChannels.channelSend(
      'foo/1',
      createServerInfo('you should not receive me'),
    );

    // subscribe again client to channel
    req = {
      realm: 'notif',
      action: 'subscribe',
      channel: '1',
      topic: 'foo',
    };
    clientSend(t.client!, req);
    const ackMsg = await ack;

    expect(ackMsg).not.toMatchObject({
      message: 'you should not receive me',
    });
    expect(ackMsg).toStrictEqual({
      realm: 'notif',
      type: 'response',
      status: 'success',
      request: req,
    });

    // now next message should be "hello again"
    const waitMsg = clientWait(t.client!, 1);
    t.server!._debug_websocketsChannels.channelSend(
      'foo/1',
      createServerInfo('hello again'),
    );
    const data = await waitMsg;

    expect(data).not.toMatchObject({
      body: 'you should not receive me',
    });
    expect(data).toStrictEqual({
      realm: 'notif',
      type: 'info',
      message: 'hello again',
    });
  });

  test('disconnect', async () => {
    expect(t.server!._debug_websocketsChannels.subscriptions.size).toEqual(1);
    clientSend(t.client!, {
      realm: 'notif',
      action: 'disconnect',
    });
    await waitForExpect(() => {
      expect(t.server!._debug_websocketsChannels.subscriptions.size).toEqual(0);
    });
  });
});

describe('channel send', () => {
  const t: Partial<{
    server: FastifyInstance;
    subs1: Array<WebSocket>;
    subs2: Array<WebSocket>;
    unsubs: Array<WebSocket>;
  }> = {};

  beforeAll(async () => {
    const config = createDefaultLocalConfig({ port: portGen.getNewPort() });

    t.server = await createWsFastifyInstance(config);

    // register a topic with validation
    t.server!.websockets!.register('foo', async (req) => {
      /* don't reject */
    });

    const numClients = 5;
    let ack;

    // spawn 5 clients and sub them to channel 1
    t.subs1 = await createWsClients(config, numClients);
    ack = clientsWait(t.subs1, 1);
    t.subs1.forEach((client) =>
      clientSend(client, {
        realm: 'notif',
        action: 'subscribe',
        channel: '1',
        topic: 'foo',
      }),
    );
    await ack;

    // spawn 5 clients and sub them to channel 2
    t.subs2 = await createWsClients(config, numClients);
    ack = clientsWait(t.subs2, 1);
    t.subs2.forEach((client) =>
      clientSend(client, {
        realm: 'notif',
        action: 'subscribe',
        channel: '2',
        topic: 'foo',
      }),
    );
    await ack;

    // spawn 5 clients and don't sub them
    t.unsubs = await createWsClients(config, numClients);
  });

  afterAll(async () => {
    t.subs1!.forEach((client) => client.close());
    t.subs2!.forEach((client) => client.close());
    t.unsubs!.forEach((client) => client.close());
    await t.server!.close();
  });

  test('channel 1', async () => {
    const msg = createServerInfo('msg1');
    const test = clientsWait(t.subs1!, 1);
    delete msg.extra;
    t.server!._debug_websocketsChannels.channelSend('foo/1', msg);
    const data = await test;
    data.forEach((value) => expect(value).toStrictEqual(msg));
  });

  test('channel 2', async () => {
    const msg = createServerInfo('msg2');
    const test = clientsWait(t.subs2!, 1);
    delete msg.extra;
    t.server!._debug_websocketsChannels.channelSend('foo/2', msg);
    const data = await test;
    data.forEach((value) => expect(value).toStrictEqual(msg));
  });

  test('channel 2 but not channel 1', async () => {
    const hello2 = createServerInfo('hello2');
    delete hello2.extra;
    const hello1 = createServerInfo('hello1');
    delete hello1.extra;
    const test1 = clientsWait(t.subs1!, 1);
    const test2 = clientsWait(t.subs2!, 1);
    t.server!._debug_websocketsChannels.channelSend('foo/1', hello1);
    t.server!._debug_websocketsChannels.channelSend('foo/2', hello2);
    const data1 = await test1;
    const data2 = await test2;
    data1.forEach((value) => expect(value).toStrictEqual(hello1));
    data2.forEach((value) => expect(value).toStrictEqual(hello2));
  });

  test('broadcast', async () => {
    const broadcastMsg = createServerInfo('hello world');
    delete broadcastMsg.extra;
    const clientsShouldReceive = new Array<WebSocket>().concat(
      t.subs1!,
      t.subs2!,
      t.unsubs!,
    );
    const test = clientsWait(clientsShouldReceive, 1);
    t.server!._debug_websocketsChannels!.broadcast(broadcastMsg);

    const data = await test;
    data.forEach((value) => expect(value).toStrictEqual(broadcastMsg));
  });
});

describe('error cases', () => {
  const t: Partial<{
    config: TestConfig;
    server: FastifyInstance;
    client: WebSocket;
  }> = {};

  beforeEach(async () => {
    t.config = createDefaultLocalConfig({ port: portGen.getNewPort() });
    t.server = await createWsFastifyInstance(t.config);
    t.client = await createWsClient(t.config);
  });

  afterEach(async () => {
    t.client!.close();
    await t.server!.close();
  });

  test('rejected validation', async () => {
    t.server!.websockets!.register('foo', async (req) => {
      // always reject
      req.reject(AccessDenied());
    });

    // subscribe to channel a, expect error response
    const ack = clientWait(t.client!, 1);
    const request: ClientMessage = {
      realm: 'notif',
      action: 'subscribe',
      channel: 'a',
      topic: 'foo',
    };
    clientSend(t.client!, request);
    expect(await ack).toStrictEqual({
      realm: 'notif',
      type: 'response',
      status: 'error',
      error: {
        name: 'ACCESS_DENIED',
        message: 'Access denied for the requested resource',
      },
      request,
    });
  });

  test('top-level error handler', async () => {
    const config = createDefaultLocalConfig({ port: portGen.getNewPort() });

    // setup logger with spy on error output, inject it into server
    const spiedLogger: FastifyLoggerInstance = createMockFastifyLogger();
    const logErrorSpy = jest.spyOn(spiedLogger, 'error');
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
    await server.close();
  });
});
