/**
 * Channels and broadcast abstractions on top of the ws library
 * 
 * @author Alexandre CHAU
 */
import WebSocket from 'ws'

function wsSend(client: WebSocket, message: any) {
    if (client.readyState === WebSocket.OPEN) {
        client.send(message)
    }
}

class Channel {
    readonly name: string
    readonly subscribers: Set<WebSocket>

    constructor(name: string) {
        this.name = name
        this.subscribers = new Set()
    }

    send(message: any) {
        this.subscribers.forEach(sub => {
            wsSend(sub, message)
        })
    }
}

class WebSocketChannels {
    wsServer: WebSocket.Server
    private channels: Map<string, Channel>
    private subscriptions: Map<WebSocket, Set<Channel>>

    constructor(wsServer: WebSocket.Server) {
        this.wsServer = wsServer
        this.channels = new Map()
        this.subscriptions = new Map()
    }

    clientRegister(ws: WebSocket) {
        this.subscriptions.set(ws, new Set())
    }

    clientRemove(ws: WebSocket) {
        const clientSubs = this.subscriptions.get(ws)
        if (clientSubs !== undefined) {
            clientSubs.forEach(channel => {
                channel.subscribers.delete(ws)
            })
        }
        this.subscriptions.delete(ws)
    }

    clientSubscribe(ws: WebSocket, channelName: string) {
        if (this.channels.has(channelName)) {
            const channel = this.channels.get(channelName)
            channel.subscribers.add(ws)
            const clientSubs = this.subscriptions.get(ws)
            if (clientSubs !== undefined) clientSubs.add(channel)
        }
    }

    clientUnsubscribe(ws: WebSocket, channelName: string) {
        if (this.channels.has(channelName)) {
            const channel = this.channels.get(channelName)
            channel.subscribers.delete(ws)
            const clientSubs = this.subscriptions.get(ws)
            if (clientSubs !== undefined) clientSubs.delete(channel)
        }
    }

    channelCreate(channelName: string) {
        const channel = new Channel(channelName)
        this.channels.set(channelName, channel)
    }

    channelDelete(channelName: string) {
        const channel = this.channels.get(channelName)
        channel.subscribers.forEach(sub => {
            const subChannels = this.subscriptions.get(sub)
            if (subChannels !== undefined) {
                subChannels.delete(channel)
            }
        })
        this.channels.delete(channelName)
    }

    channelSend(channelName: string, message: any) {
        if (this.channels.has(channelName)) {
            this.channels.get(channelName).send(message)
        }
    }

    /**
     * Sends an object message to all connected clients
     * @param message Object to broadcast to everyone
     */
    broadcast(message: any) {
        this.wsServer.clients.forEach(client => {
            wsSend(client, message)
        })
    }
}

export { WebSocketChannels }
