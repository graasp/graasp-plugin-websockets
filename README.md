# graasp-websockets

A websockets extension for Graasp exposed through a fastify plugin

![](https://img.shields.io/github/workflow/status/graasp/graasp-websockets/nodejs-ci?logo=github)

This project provides back-end support for WebSockets in the Graasp ecosystem. It implements a Fastify plugin that can be registered into the core Graasp Fastify server instance.

## Usage

This plugin requires a [Redis](https://redis.io/) instance which serves as a relay when multiple instances of Graasp run as a cluster (for instance for load balancing purposes).

Add this plugin repository to the dependencies section of the `package.json` of your Graasp server instance:

```jsonc
  "dependencies": {
      // Graasp's other dependencies...
      "graasp-websockets": "git://github.com/graasp/graasp-websockets.git#master",
  },
```

In the file of the designated WebSocket endpoint route, import the plugin:

```js
import graaspWebSockets from 'graasp-websockets';
```

Register the plugin on your Fastify instance (here `instance` is the core Graasp Fastify instance, initialized / obtained beforehand):

```js
instance
    // make sure to register the dependent services before!
    .register(databasePlugin, ...)
    .register(authPlugin, ...)
    .register(ItemMembershipsServiceApi)
    .register(ItemsServiceApi)
    //...
    // then register graasp-websockets as follows
    .register(graaspWebSockets);
```

Services that are destructured from the Fastify instance in [`src/service-api.ts`](src/service-api.ts) must be registered beforehand and decorate it with the corresponding names, as defined in `graasp-types` (e.g. `items`, `itemMemberships`, `taskRunner`, `validateSession`, ...)!

## Building locally

If you'd like to run the code for other purposes (such as reusing modules without Graasp or just trying things out locally), clone this repository with:

```
git clone https://github.com/graasp/graasp-websockets.git
```

Then navigate into the cloned folder:

```
cd graasp-websockets
```

Install the dependencies:

```
npm install
```

Compile the code:

```
npm run build
```

Files are compiled into the `dist/` folder.

You can then run tests as described [below](#testing), or import parts of the implementation into your own files.

### Channels module example

The [`examples/chat`](examples/chat/) folder provides an example usage of the [WebSocketChannels](src/ws-channels.ts) class for a use case unrelated to Graasp  by implementing a chat application on top of the channels abstraction.

Make sure to build the code as mentioned [above](#building-locally), then run the server with the following command from the root of the repo:

```
node dist/examples/chat/server.js
```

Then open the client multiple times using your favorite browser (substitute `firefox` with your browser of choice, or simply find the file in your file manager and open it several times):

```
firefox examples/chat/client.html
```

You should be able to send chat messages across all your page instances in your browser.

## Cleaning artifacts

You can clean compiled and generated files from the repository folder using:

```
npm run clean
```

## Testing

Several test suites are provided in folder [`test/`](test/). They include unit tests as well as end-to-end tests written for the [Jest](https://jestjs.io/) testing framework using the [ts-jest](https://kulshekhar.github.io/ts-jest/) transformer to run TypeScript tests directly. The configuration is specified by [`jest.config.js`](jest.config.js) with TypeScript compiler config [`tsconfig.test.json`](tsconfig.test.json).

To run the tests, make sure that you have installed the dependencies at least once:

```
npm install
```

Then simply use the `test` script (defined in [`package.json`](package.json)):

```
npm run test
```

You will obtain the Jest summary in the console.

### Code coverage

Jest will also provide code coverage results directly in the console. It also generates a detailed line coverage report in the `coverage/` folder.

You can inspect it by first running the tests and then opening the following file in your web browser (substitute `firefox` with your browser of choice, or simply find the file in your file manager and open it):

```
firefox coverage/lcov-report/index.html
```

You can then browse folders, files and lines of code with coverage annotations directly in your web browser.

### Lint issues

Code quality is enforced using [ESLint](https://eslint.org/) and its configuration is specified in [`.eslintrc.js`](.eslintrc.js) and [`.eslintignore`](.eslintignore).

To see a list of lint issues found in the code, run:

```
npm run lint
```

### Continuous integration

This repository also includes a run configuration for Github Actions in [`.github/workflows/main.yml`](.github/workflows/main.yml). [`package.json`](package.json) provides the `test:ci` script to be used for testing in continuous integration environments.

#### Troubleshooting

If your project depends on `graasp-websockets`, cannot fetch the `graasp-websockets` repository in your continuous integration system (such as Github Actions) and uses `npm ci` as the install command, try using `npm install` instead. There are known issues with Github SSH keys management.

## Repository structure

- [`.github/`](.github/): Github-related configurations, such as Actions
- [`client/`](client/): client-side interfaces and implementations
- [`examples/`](examples/): example usages of the modules in `graasp-websockets`
- [`report/`](report/): technical project report, read this if you want a more in-depth look at the project architecture
- [`src/`](src/): source code of the `graasp-websockets` plugin and its modules
- [`test/`](test/): Jest unit and end-to-end tests (file names match sources in `src/`)
- [`README.md`](README.md): [this file](README.md)
- [`tsconfig.json`](tsconfig.json): TypeScript compiler configuration for release

## Author

This project was originally written for a 2021 Master Semester project at the REACT group at EPFL:

- Alexandre CHAU (alexandre.chau@alumni.epfl.ch)
- [
Coordination & Interaction Systems Group (REACT)](https://www.epfl.ch/labs/react/)
- [Ecole Polytechnique Fédérale de Lausanne (EPFL)](https://www.epfl.ch/)

Acknowledgements:

- André NOGUEIRA
- Kim PHAN
- Denis GILLET
- Nicolas MACRIS

## License

This project and repository are licensed under the GNU Affero General Public License Version 3. Please read the [LICENSE](LICENSE) file for more details.

```
    graasp-websockets - WebSockets for Graasp
    Copyright (C) 2021 EPFL REACT

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published
    by the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.
```