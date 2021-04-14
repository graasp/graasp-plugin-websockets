/**
 * graasp-websockets
 * 
 * Channels and broadcast abstractions on top of the ws library
 * 
 * @author Alexandre CHAU
 */
import WebSocket from 'ws';
import { AjvMessageSerializer } from './impls/ajv-message-serializer';
import { createErrorMessage, ServerMessage } from './interfaces/message';
import { MessageSerializer } from './interfaces/message-serializer';

// Serializer / Deserializer instance
const serdes: MessageSerializer = new AjvMessageSerializer();

/**
 * Helper to send a message to a websocket client
 * @param client WebSocket client to send to
 * @param message ServerMessage to transmit
 */
function wsSend(client: WebSocket, message: ServerMessage) {
    if (client.readyState === WebSocket.OPEN) {
        const serialized = serdes.serialize(message);
        client.send(serialized);
    }
}

/**
 * Represents a WebSocket channel which clients can subscribe to
 * @member name Name of the channel
 * @member subscribers Subscribers to the channel
 */
class Channel {
    readonly name: string;
    readonly subscribers: Set<WebSocket>;

    constructor(name: string) {
        this.name = name;
        this.subscribers = new Set();
    }

    send(message: ServerMessage) {
        this.subscribers.forEach(sub => {
            wsSend(sub, message);
        });
    }
}

/**
 * Channels abstraction over WebSocket server
 * Logic to handle clients and channels
 */
class WebSocketChannels {
    // Underlying WebSocket server
    wsServer: WebSocket.Server;
    // Collection of existing channels, identified by name for lookup
    channels: Map<string, Channel>;
    // Collection of all client subscriptions, identified by client for lookup
    subscriptions: Map<WebSocket, Set<Channel>>;

    /**
     * Creates a new WebSocketChannels instance
     * @param wsServer Underlying WebSocket.Server
     */
    constructor(wsServer: WebSocket.Server) {
        this.wsServer = wsServer;
        this.channels = new Map();
        this.subscriptions = new Map();
    }

    /**
     * Registers a new client into the channels system
     * @param ws New client to register
     */
    clientRegister(ws: WebSocket): void {
        this.subscriptions.set(ws, new Set());

        /**
         * Handle incoming requests
         * Validate and dispatch received requests from client
         */
        ws.on('message', (message) => {
            const request = serdes.parse(message);
            if (request === undefined) {
                // validation error, send feedback
                const err = createErrorMessage({
                    name: "Invalid request message",
                    message: "Request message format was not understood by the server"
                });
                wsSend(ws, err);
            } else {
                // request is type-safe as a ClientMessage
                switch (request.action) {
                    case "disconnect": {
                        this.clientRemove(ws);
                        break;
                    }
                    case "subscribe": {
                        this.clientSubscribe(ws, request.channel);
                        break;
                    }
                    case "subscribeOnly": {
                        this.clientSubscribeOnly(ws, request.channel);
                        break;
                    }
                    case "unsubscribe": {
                        this.clientUnsubscribe(ws, request.channel);
                        break;
                    }
                }
            }
        });

        // cleanup when client closes
        ws.on('close', (code, reason) => {
            this.clientRemove(ws);
        });
    }


    /**
     * Removes a client from the channels system
     * @param ws Client to remove, nothing will happen if the client is not registered
     */
    clientRemove(ws: WebSocket): void {
        const clientSubs = this.subscriptions.get(ws);
        if (clientSubs !== undefined) {
            clientSubs.forEach(channel => {
                channel.subscribers.delete(ws);
            });
        }
        this.subscriptions.delete(ws);
    }

    /**
     * Subscribe a client to a given channel, can subscribe to many channels at once
     * @param ws client to subscribe to the channel
     * @param channelName name of the channel
     */
    clientSubscribe(ws: WebSocket, channelName: string): void {
        const channel = this.channels.get(channelName);
        if (channel !== undefined) {
            channel.subscribers.add(ws);
            const clientSubs = this.subscriptions.get(ws);
            if (clientSubs !== undefined) clientSubs.add(channel);
        }
    }

    /**
     * Subscribe a client to a single given channel, removes all prior subscriptions from this client
     * @param ws client to subscribe to the channel
     * @param channelName name of the channel
     */
    clientSubscribeOnly(ws: WebSocket, channelName: string): void {
        const clientSubs = this.subscriptions.get(ws);
        if (clientSubs !== undefined) {
            clientSubs.forEach(channel => {
                channel.subscribers.delete(ws);
                clientSubs.delete(channel);
            });
        }
        this.clientSubscribe(ws, channelName);
    }

    /**
     * Unsubscribe a client from a previously given subscribed channel
     * @param ws client to unsubscribe from channel
     * @param channelName name of the channel
     */
    clientUnsubscribe(ws: WebSocket, channelName: string): void {
        const channel = this.channels.get(channelName);
        if (channel !== undefined) {
            channel.subscribers.delete(ws);
            const clientSubs = this.subscriptions.get(ws);
            if (clientSubs !== undefined) clientSubs.delete(channel);
        }
    }

    /**
     * Create a new channel given a channel name
     * @param channelName name of the new channel
     */
    channelCreate(channelName: string): void {
        const channel = new Channel(channelName);
        this.channels.set(channelName, channel);
    }

    /**
     * Delete a channel given its name
     * @param channelName name of the channel
     */
    channelDelete(channelName: string): void {
        const channel = this.channels.get(channelName);
        if (channel !== undefined) {
            channel.subscribers.forEach(sub => {
                const subChannels = this.subscriptions.get(sub);
                if (subChannels !== undefined) {
                    subChannels.delete(channel);
                }
            });
            this.channels.delete(channelName);
        }
    }

    /**
     * Send a message on a given channel
     * @param channelName name of the channel to send a message on
     */
    channelSend(channelName: string, message: ServerMessage): void {
        const channel = this.channels.get(channelName);
        if (channel !== undefined) channel.send(message);
    }

    /**
     * Sends an object message to all connected clients
     * @param message Object to broadcast to everyone
     */
    broadcast(message: ServerMessage): void {
        this.wsServer.clients.forEach(client => {
            wsSend(client, message);
        });
    }
}

export { WebSocketChannels, serdes };
