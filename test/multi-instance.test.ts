/**
 * graasp-websockets
 *
 * Tests for {@link MultiInstanceChannelsBroker}
 *
 * @author Alexandre CHAU
 */

/* eslint-disable @typescript-eslint/no-non-null-assertion */

import Redis from 'ioredis';
import waitForExpect from 'wait-for-expect';
import globalConfig from '../src/config';
import {
  WS_CLIENT_ACTION_SUBSCRIBE,
  WS_ENTITY_ITEM,
  WS_REALM_NOTIF,
  WS_RESPONSE_STATUS_SUCCESS,
  WS_SERVER_TYPE_INFO,
  WS_SERVER_TYPE_RESPONSE,
} from '../src/interfaces/constants';
import { ClientMessage } from '../src/interfaces/message';
import { createMockFastifyLogger } from './mocks';
import {
  clientSend,
  clientWait,
  createDefaultLocalConfig,
  createWsClient,
  createWsFastifyInstance,
  PortGenerator,
} from './test-utils';

const portGen = new PortGenerator(5000);

test('Message sent on a multi-instance broker is received by all instances', async () => {
  const config1 = createDefaultLocalConfig({ port: portGen.getNewPort() });
  const config2 = createDefaultLocalConfig({ port: portGen.getNewPort() });

  // create 2 independent instance of channels broker
  const instance1 = await createWsFastifyInstance(config1);
  const instance2 = await createWsFastifyInstance(config2);

  // create "test" channel locally on both
  instance1.websocketChannels!.channelCreate('test', false);
  instance2.websocketChannels!.channelCreate('test', false);

  const client1 = await createWsClient(config1);
  const client2 = await createWsClient(config2);

  // subscribe each client to a respective broker instance on channel "test"
  const ack1 = clientWait(client1, 1);
  const ack2 = clientWait(client2, 1);
  const req: ClientMessage = {
    realm: WS_REALM_NOTIF,
    action: WS_CLIENT_ACTION_SUBSCRIBE,
    channel: 'test',
    entity: WS_ENTITY_ITEM,
  };
  clientSend(client1, req);
  clientSend(client2, req);
  const ack1Msg = await ack1;
  const ack2Msg = await ack2;
  const expected = {
    realm: WS_REALM_NOTIF,
    type: WS_SERVER_TYPE_RESPONSE,
    status: WS_RESPONSE_STATUS_SUCCESS,
    request: req,
  };
  expect(ack1Msg).toStrictEqual(expected);
  expect(ack2Msg).toStrictEqual(expected);

  // broker dispatch should be received by both clients
  const test1 = clientWait(client1, 1);
  const test2 = clientWait(client2, 1);
  instance1.websocketChannelsBroker!.dispatch('test', {
    realm: WS_REALM_NOTIF,
    type: WS_SERVER_TYPE_INFO,
    message: 'hello',
  });
  const values = await Promise.all([test1, test2]);
  values.forEach((value) => {
    expect(value).toStrictEqual({
      realm: WS_REALM_NOTIF,
      type: WS_SERVER_TYPE_INFO,
      message: 'hello',
    });
  });

  // broker broadcast should be received by both clients
  const b1 = clientWait(client1, 1);
  const b2 = clientWait(client2, 1);
  instance2.websocketChannelsBroker!.dispatch('broadcast', {
    realm: WS_REALM_NOTIF,
    type: WS_SERVER_TYPE_INFO,
    message: 'broadcast',
  });
  const values2 = await Promise.all([b1, b2]);
  values2.forEach((value) => {
    expect(value).toStrictEqual({
      realm: WS_REALM_NOTIF,
      type: WS_SERVER_TYPE_INFO,
      message: 'broadcast',
    });
  });

  client1.close();
  client2.close();
  await instance1.close();
  await instance2.close();
});

test('Message with incorrect format received from Redis triggers log', async () => {
  const config = createDefaultLocalConfig({ port: portGen.getNewPort() });
  const logger = createMockFastifyLogger();
  const logInfoSpy = jest.spyOn(logger, 'info');
  const server = await createWsFastifyInstance(config, async (instance) => {
    instance.log = logger;
  });
  const pub = new Redis({
    port: globalConfig.redis.port,
    host: globalConfig.redis.host,
    password: globalConfig.redis.password,
  });
  pub.publish(
    globalConfig.redis.notifChannel,
    JSON.stringify('Mock invalid redis message'),
  );
  await waitForExpect(() => {
    expect(logInfoSpy).toHaveBeenCalledWith(
      `graasp-websockets: MultiInstanceChannelsBroker incorrect message received from Redis channel "${globalConfig.redis.notifChannel}": "Mock invalid redis message"`,
    );
  });
  pub.disconnect();
  server.close();
});
