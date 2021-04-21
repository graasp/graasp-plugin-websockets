/**
 * graasp-websockets
 * 
 * Channels and broadcast abstractions on top of the ws library
 * 
 * @author Alexandre CHAU
 */
import WebSocket from 'ws';
import { MessageSerializer } from './interfaces/message-serializer';

/**
 * Represents a WebSocket channel which clients can subscribe to
 * @member name Name of the channel
 * @member subscribers Subscribers to the channel
 */
class Channel<ServerMessageType>{
    readonly name: string;
    readonly subscribers: Set<WebSocket>;

    constructor(name: string) {
        this.name = name;
        this.subscribers = new Set();
    }

    send(message: ServerMessageType, sendFn: (client: WebSocket, msg: ServerMessageType) => void) {
        this.subscribers.forEach(sub => {
            sendFn(sub, message);
        });
    }
}

/**
 * Channels abstraction over WebSocket server
 * Logic to handle clients and channels
 */
class WebSocketChannels<ClientMessageType, ServerMessageType> {
    // Underlying WebSocket server
    wsServer: WebSocket.Server;
    // Collection of existing channels, identified by name for lookup
    channels: Map<string, Channel<ServerMessageType>>;
    // Collection of all client subscriptions, identified by client for lookup
    subscriptions: Map<WebSocket, Set<Channel<ServerMessageType>>>;
    // Serialization / Deserialization object instance
    serdes: MessageSerializer<ClientMessageType, ServerMessageType>;

    /**
     * Creates a new WebSocketChannels instance
     * @param wsServer Underlying WebSocket.Server
     * @param serdes Message serializer/desserializer for this specific server channels abstraction
     */
    constructor(wsServer: WebSocket.Server, serdes: MessageSerializer<ClientMessageType, ServerMessageType>) {
        this.wsServer = wsServer;
        this.serdes = serdes;
        this.channels = new Map();
        this.subscriptions = new Map();
    }

    /**
     * Helper to send a message to a websocket client from this server
     * @param client WebSocket client to send to
     * @param message ServerMessage to transmit
     */
    clientSend(client: WebSocket, message: ServerMessageType): void {
        if (client.readyState === WebSocket.OPEN) {
            const serialized = this.serdes.serialize(message);
            client.send(serialized);
        }
    }

    /**
     * Registers a new client into the channels system
     * @param ws New client to register
     */
    clientRegister(ws: WebSocket): void {
        this.subscriptions.set(ws, new Set());
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
        const channel = new Channel<ServerMessageType>(channelName);
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
    channelSend(channelName: string, message: ServerMessageType): void {
        const channel = this.channels.get(channelName);
        if (channel !== undefined) channel.send(message, this.clientSend);
    }

    /**
     * Sends an object message to all connected clients
     * @param message Object to broadcast to everyone
     */
    broadcast(message: ServerMessageType): void {
        this.wsServer.clients.forEach(client => {
            this.clientSend(client, message);
        });
    }
}

export { WebSocketChannels };
