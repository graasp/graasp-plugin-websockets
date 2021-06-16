## `graasp-websockets` protocol specification

Rules for the messages transmitted over WebSocket for real-time notifications in Graasp

### Message format for Graasp

In the following code snippets, strings between angle brackets (`"<example>"`) are placeholder for dynamic values unless specified otherwise.

1. Messages are exchanged as strings over the WebSocket connection. Clients use the native WebSocket client or equivalent `send` ([API ref](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/send)), server uses the [`ws` library](https://github.com/websockets/ws) `send`: ([API ref](https://github.com/websockets/ws/blob/master/doc/ws.md#websocketsenddata-options-callback)).

2. Message strings as described in (1) encode JSON data (https://www.json.org/). They can be serialized and parsed using the [native `JSON` object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON) (e.g. `JSON.parse()` and `JSON.stringify()`) or using a library (such as [AJV](https://github.com/ajv-validator/ajv)).

3. All messages (from both client and server) must contain a `realm` field: it ensures that `graasp-websockets` can be used in the future for other usages (e.g. a chat app). The `realm` field must be set to `notif` for Graasp real-time update notifications.
    ```jsonc
    {
        "realm": "notif",
        // other fields ...
    }
    ```

4. Messages sent by clients provide an `action` field to perform subscriptions changes requests. Clients may send one of the following messages:

- Client subscribe: subscribe the WS client to the specified channel:
    ```jsonc
    {
        "realm": "notif",
        "action": "subscribe",
        "channel": "<channelName>",
        "entity": "<entityType>",
    }
    ```
    where `<channelName>` is the name of the channel to subscribe to and `<entityType>` the kind of channel to subscribe to (`item` or `member`).

- Client unsubscribe: unsubscribe the WS client from the specified channel:
    ```jsonc
    {
        "realm": "notif",
        "action": "unsubscribe",
        "channel": "<channelName>"
    }
    ```
    where `<channelName>` is the name of the channel to unsubscribe from.

- Client subscribeOnly: unsubscribe the WS client from any channel it is currently subscribed to, and then subscribe it to the specified channel:
    ```jsonc
    {
        "realm": "notif",
        "action": "subscribeOnly",
        "channel": "<channelName>",
        "entity": "<entityType>",
    }
    ```
    where `<channelName>` is the name of the only channel to subscribe to and `<entityType>` the kind of channel to subscribe to (`item` or `member`).

- Client disconnect: unsubscribes the WS client from all channels it is currently subscribed to and unregisters the WS client from `graasp-websockets`:
    ```jsonc
    {
        "realm": "notif",
        "action": "disconnect",
    }
    ```
    **After sending a client disconnect message, later requests from this client are ignored. A new WS connection must be initiated by the client before sending other requests.**

5. Messages sent by the server are either responses to client requests, real-time update notifications, or info messages. The `type` field specifies this behaviour.

- Server responses: provide feedback to a client following a request.
    ```jsonc
    {
        "realm": "notif",
        "type": "response",
        "status": "<responseStatus>",
        "error": { // optional
            "name": "<errorName>",
            "message": "<errorMessage",
        },
        "request": { /* optional, client request copy */ },
    }
    ```
    where:
    - `<responseStatus>` represents the request completion status, either `success` or `error`
    - the `error` field is optional: if and only if the `<responseStatus>` is `error`, then the `error` field is populated, otherwise it is `undefined`. The error has a name and a descriptive message
    - the `request` field is optional and it is populated with a copy of the client request object that generated this response. If the request could not be parsed into a valid object, `error.name` is set to `INVALID_REQUEST` and the `request` field is left `undefined`
    
    Possible error messages include:
    - `ACCESS_DENIED`: the client is not allowed to access the requested resource
    - `INVALID_REQUEST`: the client sent a request which format was not understood by the server
    - `NOT_FOUND`: the client or the requested resource was not found on the server
    - `SERVER_ERROR`: unexpected server error while processing the request

- Real-time updates: notifications sent to the client from a given channel which it is subscribed to.
    ```jsonc
    {
        "realm": "notif",
        "type": "update",
        "channel": "<channelName>",
        "body": { /* channel-specific object */ }
    }
    ```
    where `<channelName>` is the name of the channel on which the notification was sent. See the [Channels section below](#channels) for more details about channel-specific objects.

- Real-time server info: other real-time notifications and broadcasts that do not belong to any specific channel
    ```jsonc
    {
        "realm": "notif",
        "type": "info",
        "message": "<message>",
        "extra": { /* optional, any */ }
    }
    ```
    where `<message>` is the info message, and `extra` an optional object of any shape.

### Channels

- Clients can subscribe to events on specific channels. Channels represent entitites that may receive updates over time. Each channel may emit several kinds of events, which are specific to the entity type. The available channels, as well as the event kinds and message `body` shapes (as described above for server messages of type "Real-time updates") are described here. If a client subscribes to a channel that publishes several kinds of events, it will receive all updates from all event kinds.

- `Item` channel (from the [Item](https://github.com/graasp/graasp-types/blob/master/services/items/interfaces/item.d.ts) Graasp type)
    - Channel name: ID of the item (= value of `item.id`) to observe
    - Update message shape:
        ```jsonc
        {
            "realm": "notif",
            "type": "update",
            "channel": "<itemId>",
            "body": {
                "entity": "item",
                "kind": "<eventKind>",
                "op": "<operation>",
                "value": "<opValue>",
            }
        }
        ```
        where
        - `<eventKind>` is:
            - `childItem` to represent updates of the children of the current item
        - `<operation>` is `create` or `delete`, applied to the `<opValue>` as a child of the current item
        - `<opValue>` is the child item value
    - Notes:
        - The client must have at least read access to the item, otherwise an `ACCESS_DENIED` error response is sent

- `Member` channel (from the [Member](https://github.com/graasp/graasp-types/blob/master/services/members/interfaces/member.d.ts) Graasp type)
    - Channel name: ID of the member (= value of `member.id`) to observe
    - Update message type:
        ```jsonc
        {
            "realm": "notif",
            "type": "update",
            "channel": "<memberId>",
            "body": {
                "entity": "member",
                "kind": "<eventKind>",
                "op": "<operation>",
                "value": "<opValue>",
            }
        }
        ```
        where
        - `<eventKind>` is:
            - `sharedWith` to represent updates of the items which membership is shared with the current user
            - `<operation>` is `create` or `delete`, applied to the `<opValue>` as an item which membership applies to the current user
            - `<opValue>` is the shared item value
        - Notes:
            - The client can only subscribe to its own channel (i.e. the ID of the user session must resolve to the same ID as the channel name). Otherwise, an `ACCESS_DENIED` error response is sent

### Server-specific rules

- The shape of the JSON data is defined by both TypeScript interface definitions in `src/interfaces/` and as [JSON Type Definitions](https://jsontypedef.com/). This allows the AJV library to compile an optimized parser + validator and serializer pair ([doc](https://ajv.js.org/json-type-definition.html), [example](https://ajv.js.org/guide/typescript.html#type-safe-parsers-and-serializers)).