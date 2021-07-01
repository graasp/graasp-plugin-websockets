/**
 * graasp-websockets
 *
 * Constant strings used in {@link ServerMessage} and {@link ClientMessage}
 * @see API.md
 *
 * @author Alexandre CHAU
 */
export const WS_REALM_NOTIF = 'notif';

export const WS_ENTITY_ITEM = 'item';
export const WS_ENTITY_MEMBER = 'member';

export type EntityName = typeof WS_ENTITY_ITEM | typeof WS_ENTITY_MEMBER;

export const WS_CLIENT_ACTION_SUBSCRIBE = 'subscribe';
export const WS_CLIENT_ACTION_UNSUBSCRIBE = 'unsubscribe';
export const WS_CLIENT_ACTION_SUBSCRIBE_ONLY = 'subscribeOnly';
export const WS_CLIENT_ACTION_DISCONNECT = 'disconnect';

export type ClientAction =
  | typeof WS_CLIENT_ACTION_SUBSCRIBE
  | typeof WS_CLIENT_ACTION_UNSUBSCRIBE
  | typeof WS_CLIENT_ACTION_SUBSCRIBE_ONLY
  | typeof WS_CLIENT_ACTION_DISCONNECT;

export const WS_SERVER_TYPE_RESPONSE = 'response';
export const WS_SERVER_TYPE_UPDATE = 'update';
export const WS_SERVER_TYPE_INFO = 'info';

export type ServerResponseType =
  | typeof WS_SERVER_TYPE_INFO
  | typeof WS_SERVER_TYPE_RESPONSE
  | typeof WS_SERVER_TYPE_UPDATE;

export const WS_SERVER_ERROR_ACCESS_DENIED = 'ACCESS_DENIED';
export const WS_SERVER_ERROR_INVALID_REQUEST = 'INVALID_REQUEST';
export const WS_SERVER_ERROR_NOT_FOUND = 'NOT_FOUND';
export const WS_SERVER_ERROR_GENERIC = 'SERVER_ERROR';

export type ServerErrorName =
  | typeof WS_SERVER_ERROR_ACCESS_DENIED
  | typeof WS_SERVER_ERROR_INVALID_REQUEST
  | typeof WS_SERVER_ERROR_NOT_FOUND
  | typeof WS_SERVER_ERROR_GENERIC;

export const WS_RESPONSE_STATUS_SUCCESS = 'success';
export const WS_RESPONSE_STATUS_ERROR = 'error';

export type ServerResponseStatus =
  | typeof WS_RESPONSE_STATUS_SUCCESS
  | typeof WS_RESPONSE_STATUS_ERROR;

export const WS_UPDATE_KIND_CHILD_ITEM = 'childItem';
export const WS_UPDATE_KIND_SHARED_WITH = 'sharedWith';
export const WS_UPDATE_KIND_BAR = 'bar';

export const WS_UPDATE_OP_CREATE = 'create';
export const WS_UPDATE_OP_DELETE = 'delete';
export const WS_UPDATE_OP_FOO = 'foo';

export type ChildItemOperation =
  | typeof WS_UPDATE_OP_CREATE
  | typeof WS_UPDATE_OP_DELETE;

export type SharedWithOperation =
  | typeof WS_UPDATE_OP_CREATE
  | typeof WS_UPDATE_OP_DELETE;

export type BarOperation =
  | typeof WS_UPDATE_OP_CREATE
  | typeof WS_UPDATE_OP_DELETE
  | typeof WS_UPDATE_OP_FOO;
