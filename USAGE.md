# Adding real-time behaviour in Graasp front-end applications

You may want to add real-time interactions with the Graasp core server in your front-end application. This guide provides a step-by-step tutorial on how to either use or extend the functionalities provided by the `graasp-websockets` plugin. For server-side usage of the plugin, see [README.md](README.md).

## Exploring and using ready-to-use React hooks

If your front-end application is written in [React](https://reactjs.org/) and uses [React Query](https://react-query.tanstack.com/) to synchronize with server state, then the [graasp-query-client](https://github.com/graasp/graasp-query-client) repository already implements [hooks](https://reactjs.org/docs/hooks-intro.html) that can be readily called in your functional components.

Usually, you will combine a hook to query your data on the server core with another hook dedicated to receiving updates through a websocket channel.

The list of query hooks is available at [`graasp-query-client/src/hooks`](https://github.com/graasp/graasp-query-client/tree/main/src/hooks), while the list of websocket hooks is available here: [`graasp-query-client/src/ws/hooks.ts`](https://github.com/graasp/graasp-query-client/blob/main/src/ws/hooks.ts).

### Example

The following assumes that your application already takes care of authenticating the end-user for all subsequent requests.

In this example, we would like to display the children of a folder item (as defined by the `graasp` core) and automatically re-render the user interface when updates of children items (e.g additions and deletions from other users) are received, so that the end-user always sees a view that is consistent with the current state on the server.

First install the `graasp-query-client` dependency in your package.json:

```json
"dependencies": {
    "@graasp/query-client": "git://github.com/graasp/graasp-query-client.git",
}

```

And then run `npm install` (or `yarn install` depending on your package manager).

Make sure to provide the query client somewhere near the top of your components tree ([docs](https://react-query.tanstack.com/reference/QueryClientProvider)).

Call the corresponding query call in your component, and use it to display the children items. We assume the folder item ID is passed as a prop (`folderId`) to the component:

```jsx
import { hooks } from '@graasp/query-client';

const FolderView = ({ folderId }) => {
  const { data, isLoading } = hooks.useChildren(folderId);

  if (isLoading) {
    return <div>Loading children...</div>;
  }

  return (
    <div>
      {data.map((item) => (
        <a>{item.name}</a>
      ))}
    </div>
  );
};
```

The `useChildren` hook will take care of re-rendering the component by itself when `data` is actually available.

Now subscribe to children item updates by importing the `ws` object and calling `useChildrenUpdates` of its `hooks` property. With this hook, the view will automatically re-render to display these updates (as the query client will be mutated, which in turn causes a re-render).

```jsx
import { hooks, ws } from '@graasp/query-client'; // <- import ws

const FolderView = ({ folderId }) => {
  const { data, isLoading } = hooks.useChildren(folderId);
  ws.hooks.useChildrenUpdates(folderId); // <- add this line

  if (isLoading) {
    return <div>Loading children...</div>;
  }

  return (
    <div>
      {data.map((item) => (
        <a>{item.name}</a>
      ))}
    </div>
  );
};
```

That's it!

## Extending the `graasp-websockets` plugin

The existing hooks may not provide the functionality required by your application. This section will describe how to extend the capabilities of the plugin as well as of the query client.

### 1. Designing and extending the API

Make sure to read the Graasp websocket protocol specification at [API.md](API.md), which defines the messages exchanged between the server plugin and clients. If your desired event is already defined in the API, you can skip to step 2 and use the corresponding existing server message. Otherwise chances are that you need a new custom event message.

First define the semantics of your event by **editing [API.md#channels](API.md#channels)**. You need to decide on:

- The channel name (you may want to reuse an existing channel and augment through the properties below, or create a new family of channels altogether)

- The message body

  - You may want to use the schema already defined for existing channels. For instance, messages sent on an `Item` channel already define the `entity`, event `kind` and `op` action properties, on which you can enrich the domain of possible values to extend the different kinds of events related to the given entity.
  - You may want to mimic and add a similar schema (e.g. for another entity type)
  - Otherwise you can define your own custom body, depending on your custom front-end needs

- Do not break API compatibility! Your changes should not affect any message already defined

Once you have designed a message shape, translate it into a Typescript interface in [`src/interfaces/message.ts`](src/interfaces/message.ts). Make sure to integrate it with the existing class hierarchy, and use [`src/interfaces/constants.ts`](src/interfaces/constants.ts) to define any constant string. In particular, you will most probably either:

- extend the operations for a given channel event kind (e.g. you may want to add possible action values for `ChildItemOperation` or `SharedWithOperation`).

  For instance, say we want to add a new operation "foo" on the items channel with "childItem" event kind. Add the following in [`src/interfaces/constants.ts`](src/interfaces/constants.ts):

  ```diff
    export const WS_UPDATE_OP_CREATE = 'create';
    export const WS_UPDATE_OP_DELETE = 'delete';
  + export const WS_UPDATE_OP_FOO = 'foo';

    export type ChildItemOperation =
    | typeof WS_UPDATE_OP_CREATE
    | typeof WS_UPDATE_OP_DELETE
  + | typeof WS_UPDATE_OP_FOO;
  ```

- add an event `kind` which represents a new category of events that may happen for a specific channel.

  E.g. we want to add a new event kind called "bar" on the channel for children items which can carry actions `create`, `delete` and `foo`.

  Define the event kind string name, add the operation name as well as the operation union for this event kind in [`src/interfaces/constants.ts`](src/interfaces/constants.ts):

  ```diff
    export const WS_UPDATE_KIND_CHILD_ITEM = 'childItem';
    export const WS_UPDATE_KIND_SHARED_WITH = 'sharedWith';
  + export const WS_UPDATE_KIND_BAR = 'bar';

    ...

    export const WS_UPDATE_OP_CREATE = 'create';
    export const WS_UPDATE_OP_DELETE = 'delete';
  + export const WS_UPDATE_OP_FOO = 'foo';

    export type ChildItemOperation =
    | typeof WS_UPDATE_OP_CREATE
    | typeof WS_UPDATE_OP_DELETE;

    ...

  + export type BarOperation =
  + | typeof WS_UPDATE_OP_CREATE
  + | typeof WS_UPDATE_OP_DELETE
  + | typeof WS_UPDATE_OP_FOO;
  ```

  Create a new interface for this event kind after the existing interfaces for this entity, and add it to the body union type of this entity in [`src/interfaces/message.ts`](src/interfaces/message.ts):

  ```diff
    /**
     * Update body type for Item channels
     */
    type ItemUpdateBody = ItemChildUpdateBody
  +   | ItemBarUpdateBody;

    interface ItemChildUpdateBody {
      entity: typeof WS_ENTITY_ITEM;
      kind: typeof WS_UPDATE_KIND_CHILD_ITEM;
      op: ChildItemOperation;
      value: any; // should be Item, workaround for JTD schema
    }

  + interface ItemBarUpdateBody {
  +   entity: typeof WS_ENTITY_ITEM;
  +   kind: typeof WS_UPDATE_KIND_BAR;
  +   op: BarOperation;
  +   value: any; // should be Item, workaround for JTD schema
  + }
  ```

  Also create a factory for external creation of this update kind at the bottom of the file:

  ```diff
  + export const createBarUpdate = (
  +   itemId: string,
  +   op: ItemBarUpdateBody['op'],
  +   item: Item,
  + ): ServerUpdate =>
  +   createServerUpdate(itemId, {
  +     entity: WS_ENTITY_ITEM,
  +     kind: WS_UPDATE_KIND_BAR,
  +     op,
  +     value: item,
  +   });
  ```

- add an `entity` type:

- something else:

Then, JTD

### 2. Registering additional real-time features in `graasp-websockets`

### 3. Client-side implementation and hooks in `graasp-query-client`

## Implementing your own client for the Graasp Websocket protocol
