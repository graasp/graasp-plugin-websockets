/**
 * graasp-websockets
 *
 * Message interface that describe the shape of messages
 * in the {@link WebSocketChannels} abstraction and which
 * are exchanged with clients
 *
 * @author Alexandre CHAU
 */

import { Item } from 'graasp';
import { ChatMessage } from 'graasp-plugin-chatbox/dist/interfaces/chat-message';
import {
  ChildItemOperation,
  EntityName,
  ItemChatOperation,
  ServerErrorName,
  ServerResponseStatus,
  SharedWithOperation,
  WS_CLIENT_ACTION_DISCONNECT,
  WS_CLIENT_ACTION_SUBSCRIBE,
  WS_CLIENT_ACTION_SUBSCRIBE_ONLY,
  WS_CLIENT_ACTION_UNSUBSCRIBE,
  WS_ENTITY_CHAT,
  WS_ENTITY_ITEM,
  WS_ENTITY_MEMBER,
  WS_REALM_NOTIF,
  WS_RESPONSE_STATUS_ERROR,
  WS_RESPONSE_STATUS_SUCCESS,
  WS_SERVER_TYPE_INFO,
  WS_SERVER_TYPE_RESPONSE,
  WS_SERVER_TYPE_UPDATE,
  WS_UPDATE_KIND_CHAT_ITEM,
  WS_UPDATE_KIND_CHILD_ITEM,
  WS_UPDATE_KIND_SHARED_WITH,
} from './constants';

/**
 * Default message shape
 * Must have the WS_REALM_NOTIF type to allow future message types unrelated to notifications
 */
interface Message {
  realm: typeof WS_REALM_NOTIF;
}

/**
 * Message sent by client to disconnect
 */
interface ClientDisconnect extends Message {
  action: typeof WS_CLIENT_ACTION_DISCONNECT;
}

/**
 * Message sent by client to subscribe to some channel
 */
interface ClientSubscribe extends Message {
  action: typeof WS_CLIENT_ACTION_SUBSCRIBE;
  channel: string;
  entity: EntityName;
}

/**
 * Message sent by client to unsubscribe from some channel
 */
interface ClientUnsubscribe extends Message {
  action: typeof WS_CLIENT_ACTION_UNSUBSCRIBE;
  channel: string;
}

/**
 * Message sent by client to subscribe to a single channel
 * (i.e. it also unsubscribes it from any other channel)
 */
interface ClientSubscribeOnly extends Message {
  action: typeof WS_CLIENT_ACTION_SUBSCRIBE_ONLY;
  channel: string;
  entity: EntityName;
}

/**
 * Restricted error to be sent to clients
 */
export interface Error {
  name: ServerErrorName;
  message: string;
}

/**
 * Message sent by server as a response to a {@link ClientMessage}
 */
export interface ServerResponse extends Message {
  type: typeof WS_SERVER_TYPE_RESPONSE;
  status: ServerResponseStatus;
  error?: Error;
  request?: ClientMessage;
}

/**
 * Message sent by server for misc broadcasts unrelated to a channel
 */
export interface ServerInfo extends Message {
  type: typeof WS_SERVER_TYPE_INFO;
  message: string;
  extra?: unknown;
}

/**
 * Message sent by server for update notifications sent over a channel
 */
export interface ServerUpdate extends Message {
  type: typeof WS_SERVER_TYPE_UPDATE;
  channel: string;
  body: ItemUpdateBody | MemberUpdateBody | ChatUpdateBody;
}

/**
 * Update body type for Item channels
 */
type ItemUpdateBody = ItemChildUpdateBody;

interface ItemChildUpdateBody {
  entity: typeof WS_ENTITY_ITEM;
  kind: typeof WS_UPDATE_KIND_CHILD_ITEM;
  op: ChildItemOperation;
  value: unknown; // should be Item, workaround for JTD schema
}

/**
 * Update body type for Member channels
 */
type MemberUpdateBody = MemberSharedWithUpdateBody;

interface MemberSharedWithUpdateBody {
  entity: typeof WS_ENTITY_MEMBER;
  kind: typeof WS_UPDATE_KIND_SHARED_WITH;
  op: SharedWithOperation;
  value: unknown; // should be Item, workaround for JTD schema
}

/**
 * Update body type for Chat channels
 */
type ChatUpdateBody = ItemChatUpdateBody;

interface ItemChatUpdateBody {
  entity: typeof WS_ENTITY_CHAT;
  kind: typeof WS_UPDATE_KIND_CHAT_ITEM;
  op: ItemChatOperation;
  value: unknown; // should be ChatMessage, workaround for JTD schema
}

/**
 * Client message type is union type of all client message subtypes
 */
export type ClientMessage =
  | ClientDisconnect
  | ClientSubscribe
  | ClientUnsubscribe
  | ClientSubscribeOnly;

/**
 * Server message type is union type of all server message subtypes
 */
export type ServerMessage = ServerResponse | ServerInfo | ServerUpdate;

/**
 * Factories
 */
const createServerResponse = (
  status: ServerResponse['status'],
  error?: Error,
  request?: ClientMessage,
): ServerResponse => ({
  realm: WS_REALM_NOTIF,
  type: WS_SERVER_TYPE_RESPONSE,
  status,
  error,
  request,
});

export const createServerErrorResponse = (
  error: Error,
  request?: ClientMessage,
): ServerResponse =>
  createServerResponse(WS_RESPONSE_STATUS_ERROR, error, request);

export const createServerSuccessResponse = (
  request: ClientMessage,
): ServerResponse =>
  createServerResponse(WS_RESPONSE_STATUS_SUCCESS, undefined, request);

export const createServerInfo = (
  message: string,
  extra?: unknown,
): ServerInfo => ({
  realm: WS_REALM_NOTIF,
  type: WS_SERVER_TYPE_INFO,
  message,
  extra,
});

const createServerUpdate = (
  channel: string,
  body: ServerUpdate['body'],
): ServerUpdate => ({
  realm: WS_REALM_NOTIF,
  type: WS_SERVER_TYPE_UPDATE,
  channel,
  body,
});

export const createChildItemUpdate = (
  parentId: string,
  op: ItemChildUpdateBody['op'],
  item: Item,
): ServerUpdate =>
  createServerUpdate(parentId, {
    entity: WS_ENTITY_ITEM,
    kind: WS_UPDATE_KIND_CHILD_ITEM,
    op,
    value: item,
  });

export const createSharedWithUpdate = (
  memberId: string,
  op: MemberSharedWithUpdateBody['op'],
  sharedItem: Item,
): ServerUpdate =>
  createServerUpdate(memberId, {
    entity: WS_ENTITY_MEMBER,
    kind: WS_UPDATE_KIND_SHARED_WITH,
    op,
    value: sharedItem,
  });

export const createItemChatUpdate = (
  chatId: string,
  op: ItemChatUpdateBody['op'],
  message: ChatMessage,
): ServerUpdate =>
  createServerUpdate(chatId, {
    entity: WS_ENTITY_CHAT,
    kind: WS_UPDATE_KIND_CHAT_ITEM,
    op,
    value: message,
  });
