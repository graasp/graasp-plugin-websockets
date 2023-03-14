# Changelog

## 1.0.0 (2023-03-14)


### Features

* add behaviour of membership and item delete trigger member notif, refactor tests ([5592398](https://github.com/graasp/graasp-plugin-websockets/commit/5592398de06a7d6cf9033fc9850c6a8adf21721f))
* add demo post hook handler on create item ([185cb77](https://github.com/graasp/graasp-plugin-websockets/commit/185cb77c6eee1d1d80a5728f55db71821e3a1495))
* add multi-instance channels broker and client action acks, test: refactor test, chore: update dependencies ([ac6b4a7](https://github.com/graasp/graasp-plugin-websockets/commit/ac6b4a7faeddf88fc04b7d09abcf53942554aecb))
* add notif dispatch when item membership is created ([aa9b413](https://github.com/graasp/graasp-plugin-websockets/commit/aa9b413538fe9edc32ba50e8ac675c57aa806ec9))
* fix client message JTD schema ([2fb67ed](https://github.com/graasp/graasp-plugin-websockets/commit/2fb67ed79cf1fa1bf2d68e2e9399568b1f810b01))
* fix decorated types ([a73f7b2](https://github.com/graasp/graasp-plugin-websockets/commit/a73f7b289cc609943bcce21d57763db0f4d43bd0))
* implement channel access control ([c4c1905](https://github.com/graasp/graasp-plugin-websockets/commit/c4c190593e4a38903492af8a2e9816c3f83dc3d3))
* implement message interfaces and validation with ajv (bug: the message schema does not compile) ([4a18ce4](https://github.com/graasp/graasp-plugin-websockets/commit/4a18ce44feac7817abae0c2127c56d4551a29b02))
* implement new API types in back-end ([ecfe58e](https://github.com/graasp/graasp-plugin-websockets/commit/ecfe58ea0a04e83137a51bdbfd6112a8ad7f9128))
* implement optional garbage collection of empty channels ([8517fb9](https://github.com/graasp/graasp-plugin-websockets/commit/8517fb963ae5167a878c861be9a5b8f7d5df0d12))
* improve cleanup in error handler, use per-test server instead ([2ebb1ea](https://github.com/graasp/graasp-plugin-websockets/commit/2ebb1ea31fb2a988102bc01624883171229c947e))
* improve log, add copy task notif, add mock client ([0bad934](https://github.com/graasp/graasp-plugin-websockets/commit/0bad934580cbc6fb3f1f467a91aa1b13d99e5346))
* in-memory channels with pub/sub ([3c3e6c1](https://github.com/graasp/graasp-plugin-websockets/commit/3c3e6c11ae5caa5d6f5bcded99b772162fec45ab))
* integrate chat publish event, remove old test config ([25cd8d6](https://github.com/graasp/graasp-plugin-websockets/commit/25cd8d6d792ec0c124acee8d795e8669dd181d76))
* integrate child item create / delete with channels broker ([5dcb2d9](https://github.com/graasp/graasp-plugin-websockets/commit/5dcb2d9fb1f84936b2abf7b7cbbb6d0801df8ab0))
* periodic hearbeat keepalive check ([73614a9](https://github.com/graasp/graasp-plugin-websockets/commit/73614a9d65c27255a1f4cf650e57e017ce7107d7))
* preemptively remove channel if empty when last subscriber unsubscribes ([8ec1df4](https://github.com/graasp/graasp-plugin-websockets/commit/8ec1df436d8201fd9747a8f22daf1825a00fc2da))
* refactor to make ws channels generic (need to refactor tests) ([b131fef](https://github.com/graasp/graasp-plugin-websockets/commit/b131fef03c8627aa4417e0c8f02d47d9a25e6983))
* replace console with swappable fastify logger ([278110c](https://github.com/graasp/graasp-plugin-websockets/commit/278110ca2893224379fdc57d858ea3ba2d7589ed))
* scope channels into topics ([d536038](https://github.com/graasp/graasp-plugin-websockets/commit/d536038ef2d46c667fbf64c6d20cff859b544373))
* stubs for channels abstraction and fastify plugin ([60e7917](https://github.com/graasp/graasp-plugin-websockets/commit/60e7917af88e63cc29215ea27050430bb8b3c94b))
* update chat demo ([3792917](https://github.com/graasp/graasp-plugin-websockets/commit/3792917625213bf2712073b077a060cfe676ceda))
* update chat demo ([b3342d0](https://github.com/graasp/graasp-plugin-websockets/commit/b3342d06f050de88e405bb5839e35606afcefcec))
* upgrade websocket dependencies and refactor types ([#37](https://github.com/graasp/graasp-plugin-websockets/issues/37)) ([f5956f5](https://github.com/graasp/graasp-plugin-websockets/commit/f5956f5cce56fc26413439512781a7c43642471d))


### Bug Fixes

* also create channel in subscribeOnly ([0cef93d](https://github.com/graasp/graasp-plugin-websockets/commit/0cef93d20d1a088d872bac5357049c96d7cff239))
* always send child body in notifs ([da28597](https://github.com/graasp/graasp-plugin-websockets/commit/da28597bd77d780f896b592e5021fce47d4fcfeb))
* await validation, this scoping for subscribe functions, fix basic tests ([4131060](https://github.com/graasp/graasp-plugin-websockets/commit/4131060282666df2a1543e26655a8b4c99881faa))
* broker should publish to redis notif channel name provided from config ([2b09358](https://github.com/graasp/graasp-plugin-websockets/commit/2b09358734ff6f7d47223751c3665e94af3202b8))
* chat demo - reset input value when message sent ([b7aa5b7](https://github.com/graasp/graasp-plugin-websockets/commit/b7aa5b7b81bb81a7847ccf26e58c2e90e3754719))
* clientSubscribe called twice at same location ([b430746](https://github.com/graasp/graasp-plugin-websockets/commit/b43074638843cfec614fc6a23e751c9298f5d864))
* default plugin export ([a40b9d8](https://github.com/graasp/graasp-plugin-websockets/commit/a40b9d880ae6e25c026a47423d0fb6bcd4f23b37))
* error caught through fastify-websocket must not be raised again through conn.destroy() ([#3](https://github.com/graasp/graasp-plugin-websockets/issues/3)) ([16670d7](https://github.com/graasp/graasp-plugin-websockets/commit/16670d7339a19ec407367955a6c668548b950344))
* ignore test lint issues ([05b73b8](https://github.com/graasp/graasp-plugin-websockets/commit/05b73b8debc68a0fa49e2ce3b3e3fde1b48832db))
* invalid function parameter causing wrong 'this' binding ([3322e92](https://github.com/graasp/graasp-plugin-websockets/commit/3322e9247397f4ca0673428fda10c37f48e47dd9))
* lint issues ([91f2141](https://github.com/graasp/graasp-plugin-websockets/commit/91f2141ade85edef4a8ca65ddfa79f19f178e4b4))
* move session validation into own scope ([48715fb](https://github.com/graasp/graasp-plugin-websockets/commit/48715fba87d0d6ecc13210b4d5eb679de6ca5757))
* refactor tests to fit new architecture ([7146c71](https://github.com/graasp/graasp-plugin-websockets/commit/7146c71decb97c4a3fefd0fbdf3ad0f5a8ab1d4b))
* register client before dispatching requests ([9b7282e](https://github.com/graasp/graasp-plugin-websockets/commit/9b7282e920817086a6066e8a5da1947a1df38cca))
* remove unused import ([0c53f1e](https://github.com/graasp/graasp-plugin-websockets/commit/0c53f1e9e5cab9ea72f10607f0d24bbcd129c2fb))
* replace any with unknown ([95284df](https://github.com/graasp/graasp-plugin-websockets/commit/95284df066213208c4dc67848b71aa0402dca3c7))
* typo ([b5e16aa](https://github.com/graasp/graasp-plugin-websockets/commit/b5e16aa0f3c8cd98b0f0d39e125223778cc52f69))
* use default redis user in test case ([58fe809](https://github.com/graasp/graasp-plugin-websockets/commit/58fe80931f878bd10586e9bb1a452695ef541634))
* websocketServer property was not available on fastify instance, must await async registration ([3db5630](https://github.com/graasp/graasp-plugin-websockets/commit/3db5630469478012e594350a3e7f0aff41387261))


### Documentation

* add API usage and specification ([cbef974](https://github.com/graasp/graasp-plugin-websockets/commit/cbef9745df5a4b0975d23175093f494f404cebee))
* add JTD schema changes, remove example code ([0b3a81c](https://github.com/graasp/graasp-plugin-websockets/commit/0b3a81c7d4d8088de334a47fdcc80c09cb1abb2d))
* add USAGE.md, write basic API consumption ([7b654f1](https://github.com/graasp/graasp-plugin-websockets/commit/7b654f13310b5ac6a70e43f955ec2a75fb7ba0d1))
* add workaround for Fastify module augmentation in USAGE ([f9b2ddf](https://github.com/graasp/graasp-plugin-websockets/commit/f9b2ddf4952cd2fcee158740d4708b8dbb3e7dd4))
* finish section '1. Designing and extending the API' ([2da38a3](https://github.com/graasp/graasp-plugin-websockets/commit/2da38a36604c67eecff6a0f507389444a25a4dcc))
* move link to usage section ([c9c1bf2](https://github.com/graasp/graasp-plugin-websockets/commit/c9c1bf2c58939602a75348257c16b30c91a14aa0))
* update API ([5a19a4c](https://github.com/graasp/graasp-plugin-websockets/commit/5a19a4c878ed96dc36b5e202b1d497820c824826))
* update USAGE ([27c9444](https://github.com/graasp/graasp-plugin-websockets/commit/27c9444f527ad6cad655ecfc184c3368d872bd04))
* update USAGE with new query-client implementation ([64fe09b](https://github.com/graasp/graasp-plugin-websockets/commit/64fe09b0529249282e476e03eaeedd0b5586e5f7))
* write API design for usage ([eb0e8d0](https://github.com/graasp/graasp-plugin-websockets/commit/eb0e8d03dd8d8bc2882c819d8d51349fd7ab9847))
* write usage: client-side implementation ([c3aaa44](https://github.com/graasp/graasp-plugin-websockets/commit/c3aaa447ae53588a9446ee5648cf240ed3b97dc6))
* write usage: extending the graasp-websockets plugin ([c062393](https://github.com/graasp/graasp-plugin-websockets/commit/c062393312f3d74a66749dccccaa36b3de08f55e))
