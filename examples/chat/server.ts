/* eslint-disable @typescript-eslint/no-explicit-any */
import fastify from 'fastify';
import fws from 'fastify-websocket';
import { WebSocketChannels } from '../../src/ws-channels';

const config = {
    host: '127.0.0.1',
    port: 3000,
    prefix: '/ws'
};

const serdes = {
    serialize(msg: any): string {
        return JSON.stringify(msg);
    },

    parse(msg: string): any {
        return JSON.parse(msg);
    },
};

async function startServer() {
    const server = fastify();

    await server.register(fws);

    const wsChannels = new WebSocketChannels(server.websocketServer, serdes);

    wsChannels.channelCreate('chat');

    server.get('/chat', { websocket: true }, (conn, req) => {
        wsChannels.clientRegister(conn.socket);

        conn.socket.on('message', (data) => {
            if (typeof data === 'string') {
                const message = JSON.parse(data);
                wsChannels.broadcast(message);
            }
        });
    });

    server.listen(config.port, config.host, (err, addr) => {
        if (err) {
            console.error(err);
        }
    });
}

startServer();