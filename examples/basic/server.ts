
import fastify from 'fastify';
import graaspWebsockets from '../../src/service-api';

const config = {
    host: '127.0.0.1',
    port: 3000,
    prefix: '/ws'
};

async function startServer() {
    const server = fastify();

    await server.register(graaspWebsockets, { prefix: config.prefix });

    server.listen(config.port, config.host, (err, addr) => {
        if (err) {
            console.error(err);
        }
    });
}

startServer();