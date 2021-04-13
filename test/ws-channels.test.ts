/**
 * graasp-websockets
 * 
 * Tests for {@link WebSocketChannels}
 * 
 * @author Alexandre CHAU
 */

import WebSocket from 'ws';
import { WebSocketChannels } from '../src/ws-channels';
import { clientsWait, createDefaultLocalConfig, createWsChannels, createWsClients } from './test-utils';

const testEnv: Partial<{
    channels: WebSocketChannels,
    wss: WebSocket.Server,
    subs1: Array<WebSocket>,
    subs2: Array<WebSocket>,
}> = {};


beforeAll(async () => {
    const config = createDefaultLocalConfig({ port: 4000 });

    // create channels abstraction on some ws server
    const { channels, wss } = createWsChannels(config);
    testEnv.channels = channels;
    testEnv.wss = wss;

    // create some channels
    channels.channelCreate('1');
    channels.channelCreate('2');

    // spawn 5 clients and sub them to channel 1
    testEnv.subs1 = await createWsClients(config, 5, (client, done) => {
        client.on('open', () => {
            client.send('1');
            done();
        });
    });

    // spawn 5 clients and sub them to channel 2
    testEnv.subs2 = await createWsClients(config, 5, (client, done) => {
        client.on('open', () => {
            client.send('2');
            done();
        });
    });
});



test("Clients subscribed to channel '1' all receive 'msg1'", () => {
    const test = clientsWait(testEnv.subs1, 1).then(data => {
        data.forEach(value => {
            expect(value).toBe('msg1');
        });
    });
    testEnv.channels.channelSend('1', 'msg1');
    return test;
});

test("Clients subscribed to channel '2' all receive 'msg2", () => {
    const test = clientsWait(testEnv.subs2, 1).then(data => {
        data.forEach(value => {
            expect(value).toBe('msg2');
        });
    });
    testEnv.channels.channelSend('2', 'msg2');
    return test;
});


afterAll(() => {
    testEnv.subs1.forEach(client => client.close());
    testEnv.subs2.forEach(client => client.close());
    testEnv.wss.close();
});