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
            {data.map(item => <a>{item.name}</a>)}
        </div>
    );
}
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
            {data.map(item => <a>{item.name}</a>)}
        </div>
    );
}
```

That's it!

## Extending the `graasp-websockets` plugin

### Registering additional real-time features in `graasp-websockets`

### Client-side implementation and hooks in `graasp-query-client`

## Implementing your own client for the Graasp Websocket protocol