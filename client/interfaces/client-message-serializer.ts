/**
 * graasp-websockets
 * 
 * Serdes interface that describes serialization / deserialization
 * operations between the WebSocket.Data messages exchanged on the
 * network and the data types used in the {@link WebSocketChannels}
 * 
 * This is the dual interface of {@link MessageSerializer} (server)
 * but for clients (types are reversed). NOTE: both implementations
 * need to be compatible (e.g. both should convert to JSON)!
 * 
 * @author Alexandre CHAU
 */

import WebSocket from 'ws';
import { ClientMessage, ServerMessage } from "../../src/interfaces/message";

interface ClientMessageSerializer {
    /**
     * Serializes a client message into a raw WebSocket.Data message
     * @param message Client message to send to server
     * @returns a WebSocket.Data compatible raw message representation
     */
    serialize(message: ClientMessage): WebSocket.Data

    /**
     * Deserializes raw server data into a compatible message
     * @param data Server data received by client
     * @returns a ServerMessage or undefined if the parsing was unsuccessful
     */
    parse(data: WebSocket.Data): ServerMessage | undefined
}

export { ClientMessageSerializer };
