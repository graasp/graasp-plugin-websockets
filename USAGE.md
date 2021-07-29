# Adding real-time behaviour in Graasp applications

You may want to add real-time interactions with the Graasp core server in your front-end application, or extend the real-time capabilities of the server in your own server code (such as other plugins). This guide provides a step-by-step tutorial on how to either use or extend the functionalities provided by the `graasp-websockets` plugin. For server-side registration of the plugin, see [README.md](README.md).

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
    "@graasp/query-client": "git://github.com/graasp/graasp-query-client.git#main",
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

## Consuming the `graasp-websockets` plugin to extend real-time capabilities

The existing hooks may not provide the functionality required by your application. This section will describe how to extend the capabilities of the server as well as of the query client.

If the API already provides the interface for your feature but there is no React hook to consume the data for your needs, you can skip [below](#client-side-implementation-and-hooks-in-graasp-query-client) to implement an additional custom hook in the query client.

### Registering real-time behaviour on the server

You can register additional websocket messages using the `websockets` service decorated on the Fastify instance. This plugin must be registered beforehand, as describe in [README.md](README.md).

Add the dependency in your `package.json` which is required to correctly load the types and augmentations:

```jsonc
  "dependencies": {
      ...
      "graasp-websockets": "git://github.com/graasp/graasp-websockets.git#master",
  },
```

and then run `npm install` (or `yarn install` depending on your package manager)

Then, destructure the service from the Fastify server:

```ts
// in this example, we register behaviour from another plugin
const plugin = async (fastify, options) => {
  const { websockets } = fastify;
};
```

The `websockets` service exposes the following API: [see `WebSocketService`](src/interfaces/ws-service.ts).

Register topics with corresponding validation functions. Topics must be globally unique across the server instance as they scope channels into groups. The validation function is invoked every time a client attempts to subscribe to a channel from the requested topic. It is the responsibility of the consumer to reject invalid connections (e.g. channels that may not exist, authorization checks, etc.) using the `request.reject(error)` method of the parameter with an error of type [`Error`](src/interfaces/error.ts). Other properties can be accessed through the `request` object, such as the channel name and the requester member.

```ts
import { NotFound, AccessDenied } from 'graasp-websockets';

// register a topic called 'foo'
websockets.register('foo', async (request) => {
  const { channel, member, reject } = request;

  // example: check if the channel exists in the foo database
  const bar = await fooDb.get(channel);
  if (!bar) {
    reject(NotFound());
  }

  // example: check if member is allowed to use bar
  if (!bar.canUse(member)) {
    reject(AccessDenied());
  }
});
```

Messages can then be published either globally (i.e. across all server and client instances, even when Graasp runs in a cluster), or locally (i.e. only on the current fastify instance):

```ts
// publish a message globally to the channel `someChannelName`
websockets.publish('foo', 'someChannelName', { hello: 'world' });

// publish a message locally (i.e. only on the current server instance) to the channel `someChannelName`
websockets.publishLocal(
  'foo',
  'someChannelName',
  'Users connected to other instance will not receive me',
);
```

The special channel name `broadcast` will send the message to all connected clients (globally or locally), irrespective of the topic scope.

```ts
websockets.publish('whatever', 'broadcast', 'everyone will receive me!');
```

### Client-side implementation and hooks in `graasp-query-client`

Once your back-end implementation is ready, you can write the client code to consume your update notifications. In this section, we describe how to write custom React hooks using the `graasp-query-client`.

The repository implements a [custom WebSocket client](https://github.com/graasp/graasp-query-client/blob/main/src/ws/ws-client.ts), which takes care of communicating with the server plugin using the Graasp websocket protocol defined at [`API.md`](API.md).

To add your own hooks, modify the [`src/ws/hooks.ts`](https://github.com/graasp/graasp-query-client/blob/main/src/ws/hooks.ts) file.

In this example, we allow components to subscribe to the `bar` event on the `baz` topic. `bazId` is provided by the consumer component (e.g. when accessing the view of this `baz` object instance).

Your hook must use hook composition, and first call the `useEffect` hook with the list of dependencies as second parameter (i.e. the list of variables to watch for changes, triggering a re-render). This ensures that the subscription mechanism is synchronized with the caller component lifecycle.

Make sure to instantiate the handler function at every call of your hook: it must be passed both as argument to `subscribe` and `unsubscribe` at cleanup, to ensure that the function equality always correctly holds. React guarantees that the cleanup function is called at every re-render / component unmount, which ensures that resources are properly released (the above client will optimize and minimize the actual (un)subscription calls).

```ts
useBarUpdates: (bazId: UUID) => {
  useEffect(() => {
    if (!bazId) {
      return;
    }

    const channel: Channel = { name: userId, entity: 'baz' };

    const handler = (data: any) => {
      // here you can perform your specific front-end application action
      // in this example, we mutate the baz value in the query client
      const value = data.value;
      queryClient.setQueryData(buildBazKey(value.id), value);
    };

    websocketClient.subscribe(channel, handler);

    return function cleanup() {
      websocketClient.unsubscribe(channel, handler);
    };
  }, [bazId]);
};
```

You can then refer to the [first section of the document](USAGE.md#exploring-and-using-ready-to-use-react-hooks) to call your new custom hook in your React components.
