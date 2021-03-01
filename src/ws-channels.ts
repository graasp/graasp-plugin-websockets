/**
 * Channels and broadcast abstractions on top of the ws library
 * 
 * @author Alexandre CHAU
 */
import * as WebSocket from 'ws'

class WebSocketChannels {
    wsServer: WebSocket.Server

    constructor(wsServer: WebSocket.Server) {
        this.wsServer = wsServer
    }

    /**
     * Sends an object message to all connected clients
     * @param message Object to broadcast to everyone
     */
    broadcast(message: any) {
        this.wsServer.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN)
                client.send(message)
        })
    }
}

export { WebSocketChannels }
