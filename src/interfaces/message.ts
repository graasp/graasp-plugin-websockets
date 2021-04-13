/**
 * graasp-websockets
 * 
 * Message interface that describe the shape of messages
 * in the {@link WebSocketChannels} abstraction and which
 * are exchanged with clients
 * 
 * @author Alexandre CHAU
 */

/**
 * Default message shape
 * Must have the "notif" type to allow future message types unrelated to notifications
 */
interface Message {
    type: "notif",
}

/**
 * Message sent by client to disconnect
 */
interface ClientDisconnect extends Message {
    action: "disconnect",
}

/**
 * Message sent by client to subscribe to some channel
 */
interface ClientSubscribe extends Message {
    action: "subscribe",
    channel: string,
}

/**
 * Message sent by client to unsubscribe from some channel
 */
interface ClientUnsubscribe extends Message {
    action: "unsubscribe",
    channel: string,
}

/**
 * Message sent by client to subscribe to a single channel
 * (i.e. it also unsubscribes it from any other channel)
 */
interface ClientSubscribeOnly extends Message {
    action: "subscribeOnly",
    channel: string,
}

/**
 * Error message sent by server
 */
interface ServerError extends Message {
    error: Error
}

/**
 * Factory to create a server error message
 */
function createErrorMessage(error: Error): ServerError {
    return {
        type: "notif",
        error: error,
    };
}

/**
 * Arbitrary data sent by server
 * TODO: replace with actual data types sent by server
 */
interface ServerPayload extends Message {
    payload: any
}

/**
 * Factory to create a server payload message
 */
function createPayloadMessage(data: any): ServerPayload {
    return {
        type: "notif",
        payload: data,
    };
}

/**
 * Client message type is union type of all client message subtypes
 */
type ClientMessage = ClientDisconnect | ClientSubscribe | ClientUnsubscribe | ClientSubscribeOnly;

/**
 * Server message type is union type of all server message subtypes
 */
type ServerMessage = ServerError | ServerPayload;

export { ClientMessage, ServerMessage, createErrorMessage, createPayloadMessage };
