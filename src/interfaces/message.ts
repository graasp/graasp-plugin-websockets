/**
 * graasp-websockets
 *
 * Message interface that describe the shape of messages
 * in the Graasp websocket protocol
 */

import {
  CLIENT_ACTION_DISCONNECT,
  CLIENT_ACTION_SUBSCRIBE,
  CLIENT_ACTION_SUBSCRIBE_ONLY,
  CLIENT_ACTION_UNSUBSCRIBE,
  REALM_NOTIF,
  RESPONSE_STATUS_ERROR,
  RESPONSE_STATUS_SUCCESS,
  SERVER_TYPE_INFO,
  SERVER_TYPE_RESPONSE,
  SERVER_TYPE_UPDATE,
} from './constants';
import { Error } from './error';

/**
 * Default message shape
 * Must have the REALM_NOTIF type to allow future message types unrelated to notifications
 */
interface Message {
  realm: typeof REALM_NOTIF;
}

/**
 * Message sent by client to disconnect
 */
export interface ClientDisconnect extends Message {
  action: typeof CLIENT_ACTION_DISCONNECT;
}

/**
 * Message sent by client to subscribe to some channel
 */
export interface ClientSubscribe extends Message {
  action: typeof CLIENT_ACTION_SUBSCRIBE;
  topic: string;
  channel: string;
}

/**
 * Message sent by client to unsubscribe from some channel
 */
export interface ClientUnsubscribe extends Message {
  action: typeof CLIENT_ACTION_UNSUBSCRIBE;
  topic: string;
  channel: string;
}

/**
 * Message sent by client to subscribe to a single channel
 * (i.e. it also unsubscribes it from any other channel)
 */
export interface ClientSubscribeOnly extends Message {
  action: typeof CLIENT_ACTION_SUBSCRIBE_ONLY;
  topic: string;
  channel: string;
}

/**
 * Message sent by server as a response to a {@link ClientMessage}
 */
export interface ServerResponse extends Message {
  type: typeof SERVER_TYPE_RESPONSE;
  status: typeof RESPONSE_STATUS_SUCCESS | typeof RESPONSE_STATUS_ERROR;
  error?: Error;
  request?: ClientMessage;
}

/**
 * Message sent by server for misc broadcasts unrelated to a channel
 */
export interface ServerInfo extends Message {
  type: typeof SERVER_TYPE_INFO;
  message: string;
  extra?: unknown;
}

/**
 * Message sent by server for update notifications sent over a channel
 */
export interface ServerUpdate extends Message {
  type: typeof SERVER_TYPE_UPDATE;
  topic: string;
  channel: string;
  body: unknown;
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
  realm: REALM_NOTIF,
  type: SERVER_TYPE_RESPONSE,
  status,
  error,
  request,
});

export const createServerErrorResponse = (
  error: Error,
  request?: ClientMessage,
): ServerResponse =>
  createServerResponse(RESPONSE_STATUS_ERROR, error, request);

export const createServerSuccessResponse = (
  request: ClientMessage,
): ServerResponse =>
  createServerResponse(RESPONSE_STATUS_SUCCESS, undefined, request);

export const createServerInfo = (
  message: string,
  extra?: unknown,
): ServerInfo => ({
  realm: REALM_NOTIF,
  type: SERVER_TYPE_INFO,
  message,
  extra,
});

export const createServerUpdate = (
  topic: string,
  channel: string,
  body: ServerUpdate['body'],
): ServerUpdate => ({
  realm: REALM_NOTIF,
  type: SERVER_TYPE_UPDATE,
  topic,
  channel,
  body,
});
