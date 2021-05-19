/**
 * graasp-websockets
 * 
 * Tests for {@link MultiInstanceChannelsBroker}
 * 
 * @author Alexandre CHAU
 */

import { createPayloadMessage } from "../src/interfaces/message";
import { clientSend, clientWait, createDefaultLocalConfig, createWsClient, createWsFastifyInstance, PortGenerator } from "./test-utils";

const portGen = new PortGenerator(5000);

test('Message sent on a multi-instance broker is received by all instances', async () => {
    const config1 = createDefaultLocalConfig({ port: portGen.getNewPort() });
    const config2 = createDefaultLocalConfig({ port: portGen.getNewPort() });

    // create 2 independent instance of channels broker
    const instance1 = await createWsFastifyInstance(config1);
    const instance2 = await createWsFastifyInstance(config2);

    // create "test" channel locally on both
    instance1.websocketChannels.channelCreate("test", false);
    instance2.websocketChannels.channelCreate("test", false);

    const client1 = await createWsClient(config1);
    const client2 = await createWsClient(config2);

    // subscribe each client to a respective broker instance on channel "test"
    const ack1 = clientWait(client1, 1);
    const ack2 = clientWait(client2, 1);
    clientSend(client1, { realm: "notif", action: "subscribe", channel: "test" });
    clientSend(client2, { realm: "notif", action: "subscribe", channel: "test" });
    const ack1Msg = await ack1;
    const ack2Msg = await ack2;
    expect(ack1Msg).toMatchObject({ body: { status: "success", action: "subscribe", channel: "test" } });
    expect(ack2Msg).toMatchObject({ body: { status: "success", action: "subscribe", channel: "test" } });

    // broker dispatch should be received by both clients
    const test1 = clientWait(client1, 1);
    const test2 = clientWait(client2, 1);
    instance1.websocketChannelsBroker.dispatch(createPayloadMessage("hello"), "test");
    const values = await Promise.all([test1, test2]);
    values.forEach(value => {
        expect(value).toStrictEqual({ realm: "notif", body: "hello" });
    });

    client1.close();
    client2.close();
    await instance1.close();
    await instance2.close();
});