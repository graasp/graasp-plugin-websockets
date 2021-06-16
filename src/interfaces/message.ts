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
    name: "ACCESS_DENIED" | "INVALID_REQUEST" | "NOT_FOUND",
    message: string,
}

/**
 * Message sent by server as a response to a {@link ClientMessage}
 */
interface ServerResponse extends Message {
    type: "response",
    status: "success" | "error",
    error?: Error,
    request?: ClientMessage,
}

/**
 * Message sent by server for misc broadcasts unrelated to a channel
 */
interface ServerInfo extends Message {
    type: "info",
    message: string,
    extra?: any,
}

/**
 * Message sent by server for update notifications sent over a channel
 */
interface ServerUpdate extends Message {
    type: "update",
    channel: string,
    body: ItemUpdateBody | MemberUpdateBody,
}

/**
 * Update body type for Item channels
 */
type ItemUpdateBody = ItemChildUpdateBody

interface ItemChildUpdateBody {
    entity: "item",
    kind: "childItem",
    operation: "create" | "delete",
    value: any, // should be Item, workaround for JTD schema
}

/**
 * Update body type for Member channels
 */
type MemberUpdateBody = MemberSharedWithUpdateBody

interface MemberSharedWithUpdateBody {
    entity: "member",
    kind: "sharedWith",
    operation: "create" | "delete",
    value: any, // should be Item, workaround for JTD schem
}

/**
 * Client message type is union type of all client message subtypes
 */
type ClientMessage = ClientDisconnect | ClientSubscribe | ClientUnsubscribe | ClientSubscribeOnly;

/**
 * Server message type is union type of all server message subtypes
 */
type ServerMessage = ServerResponse | ServerInfo | ServerUpdate

/**
 * Factories
 */
const createServerResponse = (status: ServerResponse["status"], error?: Error, request?: ClientMessage): ServerResponse => ({
    realm: "notif",
    type: "response",
    status,
    error,
    request,
});

const createServerErrorResponse = (error: Error, request?: ClientMessage): ServerResponse =>
    createServerResponse("error", error, request);

const createServerSuccessResponse = (request: ClientMessage): ServerResponse =>
    createServerResponse("success", undefined, request);

const createServerInfo = (message: string, extra?: any): ServerInfo => ({
    realm: "notif",
    type: "info",
    message,
    extra,
});

const createServerUpdate = (channel: string, body: ServerUpdate["body"]): ServerUpdate => ({
    realm: "notif",
    type: "update",
    channel,
    body,
});

const createChildItemUpdate = (parentId: string, operation: ItemUpdateBody["operation"], item: Item): ServerUpdate =>
    createServerUpdate(parentId, {
        entity: "item",
        kind: "childItem",
        operation,
        value: item,
    });

const createSharedWithUpdate = (memberId: string, operation: MemberSharedWithUpdateBody["operation"], sharedItem: Item): ServerUpdate =>
    createServerUpdate(memberId, {
        entity: "member",
        kind: "sharedWith",
        operation,
        value: sharedItem,
    });

export {
    ClientMessage,
    ServerMessage,
    createServerInfo,
    createServerErrorResponse,
    createServerSuccessResponse,
    createChildItemUpdate,
    createSharedWithUpdate,
};

