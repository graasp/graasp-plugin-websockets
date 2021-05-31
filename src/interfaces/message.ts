/**
 * graasp-websockets
 * 
 * Message interface that describe the shape of messages
 * in the {@link WebSocketChannels} abstraction and which
 * are exchanged with clients
 * 
 * @author Alexandre CHAU
 */

import { Item } from "graasp";

/**
 * Default message shape
 * Must have the "notif" type to allow future message types unrelated to notifications
 */
interface Message {
    realm: "notif",
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
 * Restricted error to be sent to clients
 */
interface Error {
    name: string,
    message: string,
}

/**
 * Message sent by server
 */
interface ServerMessage extends Message {
    error?: Error
    channel?: string
    type?: "sharedItem" | "childItem"
    action?: "create" | "delete"
    body?: any
}

/**
 * Factory to create a server error message
 */
function createErrorMessage(error: Error): ServerMessage {
    return {
        realm: "notif",
        error: error,
    };
}

/**
 * Factory to create a server payload message
 */
function createPayloadMessage(data: any): ServerMessage {
    return {
        realm: "notif",
        body: data,
    };
}

/**
 * Factory to create a shared item notification
 */
function createSharedItemNotif(userId: string, item: Item, action: "create" | "delete"): ServerMessage {
    return {
        realm: "notif",
        channel: userId,
        type: "sharedItem",
        action: action,
        body: (action === "delete") ? undefined : item,
    };
}

/**
 * Factory to create a child item notification
 */
function createChildItemNotif(parentId: string, child: Item, action: "create" | "delete"): ServerMessage {
    return {
        realm: "notif",
        channel: parentId,
        type: "childItem",
        action: action,
        body: (action === "delete") ? undefined : child,
    };
}

/**
 * Client message type is union type of all client message subtypes
 */
type ClientMessage = ClientDisconnect | ClientSubscribe | ClientUnsubscribe | ClientSubscribeOnly;

export { ClientMessage, ServerMessage, createErrorMessage, createPayloadMessage, createSharedItemNotif, createChildItemNotif };
