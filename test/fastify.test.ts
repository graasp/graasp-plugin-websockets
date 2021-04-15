/**
 * graasp-websockets
 * 
 * Tests for fastify
 * 
 * @author Alexandre CHAU
 */

import fws from 'fastify-websocket';
import { createDefaultLocalConfig, createFastifyInstance, createWsClients, PortGenerator } from './test-utils';

const portGen = new PortGenerator(3000);

const message = { a: 2, b: 'test' };

const schema = {
    body: {
        type: 'object',
        required: ['a', 'b'],
        properties: {
            a: { type: 'number' },
            b: { type: 'string' },
        },
    },
};

/**
 * This does not test the behaviour of our code, but simply exhibits a behavior of fastify-websocket:
 * fastify will validate the schema on the response instead of the request on a GET endpoint
 * See https://www.fastify.io/docs/v3.12.x/Validation-and-Serialization/#validation
 */
test('fastify validates body response instead of request on GET endpoint', async () => {
    const config = createDefaultLocalConfig({ port: portGen.getNewPort() });
    const test = new Promise((resolve, reject) => {
        createFastifyInstance(config, async instance => {
            await instance.register(fws, {
                errorHandler: (err, conn, req, reply) => {
                    // when the client connects, this error handler will be triggered
                    // the returned body will not match the schema
                    conn.destroy();
                    instance.close();
                    reject(err.message);
                }
            });
            instance.get(config.prefix, { websocket: true, schema }, (connection, req) => {
                /* noop */
            });
        }).then(_ => {
            createWsClients(config, 1, (client, done) => {
                client.on('open', () => {
                    client.send(JSON.stringify(message));
                    client.close();
                    done();
                });
            });
        });
    });

    return expect(test).rejects.toMatch('body should be object');
});


/**
 * This does not test the behaviour of our code, but simply exhibits a behavior of fastify-websocket:
 * websocket connections can only be established over GET requests
 */
test('fastify-websocket cannot accept POST requests for websocket connections', async () => {
    const config = createDefaultLocalConfig({ port: portGen.getNewPort() });
    const test = createFastifyInstance(config, async instance => {
        await instance.register(fws);
        instance.post(config.prefix, { websocket: true }, (connection, req) => {
            throw new Error('This line should never be reached, the server should not be able to start');
        });
    });

    return expect(test).rejects.toMatch('websocket handler can only be declared in GET method');
});