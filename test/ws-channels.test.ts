/**
 * graasp-websockets
 *
 * Tests for {@link WebSocketChannels}
 *
 * @author Alexandre CHAU
 */

/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */

import waitForExpect from 'wait-for-expect';
import WebSocket, { CLOSED, OPEN } from 'ws';
import { createServerInfo } from '../src/interfaces/message';
import {
  createConnUrl,
  createDefaultLocalConfig,
  createWsChannels,
  createWsClient,
  createWsClients,
  PortGenerator,
} from './test-utils';

const portGen = new PortGenerator(4000);

describe('Server internal behavior', () => {
  test('Adding / removing a channel is registered', () => {
    const config = createDefaultLocalConfig({ port: portGen.getNewPort() });
    const { channels: server, wss } = createWsChannels(config);
    expect(server.channels.size).toEqual(0);
    server.channelCreate('hello', false);
    expect(server.channels.size).toEqual(1);
    expect(server.channels.get('hello')).toEqual({
      name: 'hello',
      removeIfEmpty: false,
      subscribers: new Set(),
    });
    server.channelCreate('world', false);
    expect(server.channels.size).toEqual(2);
    expect(server.channels.get('hello')).toEqual({
      name: 'hello',
      removeIfEmpty: false,
      subscribers: new Set(),
    });
    expect(server.channels.get('world')).toEqual({
      name: 'world',
      removeIfEmpty: false,
      subscribers: new Set(),
    });
    server.channelDelete('unknown');
    expect(server.channels.size).toEqual(2);
    server.channelDelete('hello');
    expect(server.channels.size).toEqual(1);
    expect(server.channels.get('hello')).toEqual(undefined);
    expect(server.channels.get('world')).toEqual({
      name: 'world',
      removeIfEmpty: false,
      subscribers: new Set(),
    });
    server.channelDelete('world');
    expect(server.channels.size).toEqual(0);
    wss.close();
  });

  test('Client with broken connection is unregistered by heartbeat', async () => {
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
    clients.forEach((client) => client.close());
    wss.close();
  });

  test('Empty channel with removeIfEmpty flag is eventually removed by heartbeat', async () => {
    const config = createDefaultLocalConfig({ port: portGen.getNewPort() });
    const { channels, wss } = createWsChannels(config, 100);
    channels.channelCreate('test', true);
    expect(channels.channels.size).toEqual(1);
    await waitForExpect(() => {
      expect(channels.channels.size).toEqual(0);
    });
    wss.close();
  });

  test('Client without subscription mapping is eventually removed by heartbeat', async () => {
    const config = createDefaultLocalConfig({ port: portGen.getNewPort() });
    const { channels, wss } = createWsChannels(config, 100);
    const client = await createWsClient(config);
    expect(channels.subscriptions.size).toEqual(1);
    // forcefully remove mapping
    channels.subscriptions.forEach((_, ws) =>
      channels.subscriptions.delete(ws),
    );
    await waitForExpect(() => {
      // client connection should be eventually terminated
      expect(client.readyState).toEqual(CLOSED);
    });
    // server should not have client anymore
    expect(channels.wsServer.clients.size).toEqual(0);
    client.close();
    wss.close();
  });

  test('Send on non-existing channel returns false', async () => {
    const config = createDefaultLocalConfig({ port: portGen.getNewPort() });
    const { channels, wss } = createWsChannels(config);
    expect(
      channels.channelSend('foo', createServerInfo('hello world')),
    ).toEqual(false);
    wss.close();
  });

  test('Send to a non-ready client returns false', async () => {
    const config = createDefaultLocalConfig({ port: portGen.getNewPort() });
    const { channels, wss } = createWsChannels(config);
    const client = new WebSocket(createConnUrl(config));
    expect(
      channels.clientSend(client, createServerInfo('hello world')),
    ).toEqual(false);
    await waitForExpect(() => {
      // wait for client to be ready for proper teardown
      expect(client.readyState).toEqual(OPEN);
    });
    client.close();
    wss.close();
  });
});
