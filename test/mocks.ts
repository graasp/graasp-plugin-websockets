/**
 * graasp-websockets
 * 
 * Mock instances for testing in graasp-websockets
 * 
 * @author Alexandre CHAU
 */

import { FastifyLoggerInstance } from 'fastify';
import { Actor, Database, ItemMembership, ItemMembershipService, ItemMembershipTaskManager, ItemService, ItemTaskManager, PermissionLevel, PostHookHandlerType, PreHookHandlerType, Task, TaskHookHandlerHelpers, TaskRunner } from 'graasp';

/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-explicit-any */

const createPromise = <T>(createItemFn: () => T) => new Promise<T>((resolve, reject) => resolve(createItemFn()));

export const createMockItem = (extra?) => ({
    id: "mockItemId",
    name: "mockItemName",
    description: "mockItemDescription",
    type: "mockItemType",
    path: "mockItemPath",
    extra: extra !== undefined ? extra : { foo: "bar" },
    creator: "mockItemCreator",
    createdAt: "mockItemCreatedAt",
    updatedAt: "mockItemUpdatedAt",
});

const createMockItemArray = () => [createMockItem()];

const createMockTask = <T>(actor, createResultFn: () => T): Task<Actor, T> => ({
    name: "mockTaskName",
    actor: actor,
    status: 'NEW',
    result: createResultFn(),
    run: (handler, log) => createPromise(() => { })
});

const mockItemTaskManager: ItemTaskManager = {
    getCreateTaskName: () => "itemCreate",
    getGetTaskName: () => "itemGet",
    getUpdateTaskName: () => "itemUpdate",
    getDeleteTaskName: () => "itemDelete",
    getMoveTaskName: () => "itemMove",
    getCopyTaskName: () => "itemCopy",
    getGetChildrenTaskName: () => "itemGetChildren",
    getGetOwnTaskName: () => "itemGetOwn",
    getGetSharedWithTaskName: () => "itemGetSharedWith",
    createCreateTask: jest.fn((actor, object) => createMockTask(actor, createMockItem)),
    createGetTask: jest.fn((actor, objetId) => createMockTask(actor, createMockItem)),
    createUpdateTask: jest.fn((actor, objectId, object) => createMockTask(actor, createMockItem)),
    createDeleteTask: jest.fn((actor, objectId) => createMockTask(actor, createMockItem)),
    createMoveTask: jest.fn((actor, itemId) => createMockTask(actor, createMockItem)),
    createCopyTask: jest.fn((actor, itemId) => createMockTask(actor, createMockItem)),
    createGetChildrenTask: jest.fn((actor, itemId) => createMockTask(actor, createMockItemArray)),
    createGetOwnTask: jest.fn((actor) => createMockTask(actor, createMockItemArray)),
    createGetSharedWithTask: jest.fn((actor) => createMockTask(actor, createMockItemArray)),
};

const mockItemService: ItemService = {
    get: jest.fn((id, transactionHandler) => createPromise(createMockItem)),
    getMatchingPath: jest.fn((path, transactionHandler) => createPromise(createMockItem)),
    getMany: jest.fn((ids, transactionHandler) => createPromise(createMockItemArray)),
    create: jest.fn((item, transactionHandler) => createPromise(createMockItem)),
    update: jest.fn((id, data, transactionHandler) => createPromise(createMockItem)),
    delete: jest.fn((id, transactionHandler) => createPromise(createMockItem)),
    getNumberOfChildren: jest.fn((item, transactionHandler) => createPromise(() => 0)),
    getChildren: jest.fn((item, transactionHandler) => createPromise(createMockItemArray)),
    getNumberOfDescendants: jest.fn((item, transactionHandler) => createPromise(() => 0)),
    getDescendants: jest.fn((item, transactionHandler) => createPromise(createMockItemArray)),
    getNumberOfLevelsToFarthestChild: jest.fn((item, transactionHandler) => createPromise(() => 0)),
    getOwn: jest.fn((memberId, transactionHandler) => createPromise(createMockItemArray)),
    getSharedWith: jest.fn((memberId, transactionHandler) => createPromise(createMockItemArray)),
    move: jest.fn((item, transactionHandler) => createPromise(() => { })),
};

export const createMockItemMembership = (): ItemMembership => ({
    id: "mockMembershipId",
    memberId: "mockMembershipMemberId",
    itemPath: "mockMembershipItemPath",
    permission: "admin" as PermissionLevel, // hack to avoid runtime TypeError
    creator: "mockMembershipCreator",
    createdAt: "mockMembershipCreatedAt",
    updatedAt: "mockMembershipUpdatedAt",
});

const createMockItemMembershipArray = () => [createMockItemMembership()];

const mockItemMembershipTaskManager: ItemMembershipTaskManager = {
    getCreateTaskName: () => "membershipCreate",
    getGetTaskName: () => "membershipGet",
    getUpdateTaskName: () => "membershipUpdate",
    getDeleteTaskName: () => "membershipDelete",
    getGetOfItemTaskName: () => "membershipGetOfItem",
    createCreateTask: jest.fn((actor, object) => createMockTask(actor, createMockItemMembership)),
    createGetTask: jest.fn((actor, objectId) => createMockTask(actor, createMockItemMembership)),
    createUpdateTask: jest.fn((actor, objectId, object) => createMockTask(actor, createMockItemMembership)),
    createDeleteTask: jest.fn((actor, objectId) => createMockTask(actor, createMockItemMembership)),
    createGetOfItemTask: jest.fn((actor, itemId) => createMockTask(actor, createMockItemMembershipArray)),
};

const mockItemMembershipService: ItemMembershipService = {
    getPermissionLevel: jest.fn((memberId, item, transactionHandler) => createPromise(() => PermissionLevel.Admin)),
    getInherited: jest.fn((memberId, item, transactionHandler) => createPromise(createMockItemMembership)),
    getAllBelow: jest.fn((memberId, item, transactionHandler) => createPromise(createMockItemMembershipArray)),
    getInheritedForAll: jest.fn((item, transactionHandler) => createPromise(createMockItemMembershipArray)),
    canRead: jest.fn((memberId, item, transactionHandler) => createPromise(() => true)),
    canWrite: jest.fn((memberId, item, transactionHandler) => createPromise(() => true)),
    canAdmin: jest.fn((memberId, item, transactionHandler) => createPromise(() => true)),
    get: jest.fn((id, transactionHandler) => createPromise(createMockItemMembership)),
    create: jest.fn((membership, transactionHandler) => createPromise(createMockItemMembership)),
    createMany: jest.fn((memberships, transactionHandler) => createPromise(createMockItemMembershipArray)),
    update: jest.fn((id, permission, transactionHandler) => createPromise(createMockItemMembership)),
    delete: jest.fn((id, transactionHandler) => createPromise(createMockItemMembership)),
    deleteManyMatching: jest.fn((memberships, transactionHandler) => createPromise(createMockItemMembershipArray)),
    moveHousekeeping: jest.fn((item, member, transactionHandler) => createPromise(() => ({
        inserts: createMockItemMembershipArray(),
        deletes: createMockItemMembershipArray(),
    }))),
    ...{} as any,
};

export const mockItemsManager = {
    taskManager: mockItemTaskManager,
    dbService: mockItemService,
    extendCreateSchema: (itemTypeSchema) => { },
    extendExtrasUpdateSchema: (itemTypeSchema) => { },
};

export const mockItemMembershipsManager = {
    taskManager: mockItemMembershipTaskManager,
    dbService: mockItemMembershipService,
};

// mock task runner storage for handlers
const mockTaskRunnerState = {
    handlers: {
        pre: new Map<string, Array<PreHookHandlerType<any, unknown>>>(),
        post: new Map<string, Array<PostHookHandlerType<any, unknown>>>(),
    },
};

// augment mockTaskRunner with ability to run handlers manually for testing
declare module 'graasp' {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface TaskRunner<A extends Actor> {
        runPre<T>(taskName: string, param: T): Promise<void[]>
        runPost<T>(taskName: string, param: T): Promise<void[]>
        clearHandlers()
    }
}

const mockActor: Actor = {
    id: "mock",
};

const mockFastifyLogger: FastifyLoggerInstance = ({
    ...console,
    fatal: console.error,
    child: (bindings) => mockFastifyLogger,
});

const mockHelpers: TaskHookHandlerHelpers = {
    log: mockFastifyLogger,
};

export const mockTaskRunner: TaskRunner<Actor> = {
    runSingle: <T>(task: Task<Actor, T>) => createPromise(() => task.result),
    runMultiple: (tasks: Task<Actor, unknown>[]) => createPromise(() => tasks.map(t => t.result)),
    setTaskPreHookHandler: (taskName, handler) => {
        const preHandlers = mockTaskRunnerState.handlers.pre;
        preHandlers.has(taskName) ? preHandlers.get(taskName)?.push(handler) : preHandlers.set(taskName, [handler]);
    },
    setTaskPostHookHandler: (taskName, handler) => {
        const postHandlers = mockTaskRunnerState.handlers.post;
        postHandlers.has(taskName) ? postHandlers.get(taskName)?.push(handler) : postHandlers.set(taskName, [handler]);
    },
    unsetTaskPreHookHandler: (taskName, handler) => {
        const preHandlers = mockTaskRunnerState.handlers.pre;
        const taskPreHandlers = preHandlers.get(taskName);
        if (taskPreHandlers !== undefined) {
            preHandlers.set(taskName, taskPreHandlers.filter(h => h !== handler));
        }
    },
    unsetTaskPostHookHandler: (taskName, handler) => {
        const postHandlers = mockTaskRunnerState.handlers.post;
        const taskPostHandlers = postHandlers.get(taskName);
        if (taskPostHandlers !== undefined) {
            postHandlers.set(taskName, taskPostHandlers.filter(h => h !== handler));
        }
    },
    runPre: <T>(taskName: string, param: T) => Promise.all(mockTaskRunnerState.handlers.pre.get(taskName)?.map(async h => await h(param, mockActor, mockHelpers)) ?? []),
    runPost: <T>(taskName: string, param: T) => Promise.all(mockTaskRunnerState.handlers.post.get(taskName)?.map(async h => await h(param, mockActor, mockHelpers)) ?? []),
    clearHandlers: () => ["pre", "post"].forEach(p => mockTaskRunnerState.handlers[p].clear()),
};

export const mockDatabase: Database = {
    pool: {}
};

const createMockMember = (extra?) => ({
    name: "mockMemberName",
    email: "mockMemberEmail",
    id: "mockMemberId",
    type: "individual",
    extra,
    createdAt: "mockMemberCreatedAt",
    updatedAt: "mockMemberUpdatedAt",
});

// mock preHandler to be injected in test fastify instance to simulate authentication
export const mockSessionPreHandler = async (request, reply) => {
    request.member = createMockMember();
};

// Signature of @types/graasp/plugins/auth/interfaces/auth.d.ts is wrong! Force return of Promise
// instead of void to ensure termination (https://www.fastify.io/docs/latest/Hooks/#prehandler).
export const mockValidateSession = jest.fn((request, reply) => Promise.resolve());