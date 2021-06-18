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

export const createMockActor = () => ({
    id: "mockActorId",
});

const createMockItemArray = () => [createMockItem()];

const createMockTask = <T>(createActorFn: () => Actor, createResultFn: () => T): Task<Actor, T> => ({
    name: "mockTaskName",
    actor: createActorFn(),
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
    createCreateTask: jest.fn().mockReturnValue(createMockTask(createMockActor, createMockItem)),
    createGetTask: jest.fn().mockReturnValue(createMockTask(createMockActor, createMockItem)),
    createUpdateTask: jest.fn().mockReturnValue(createMockTask(createMockActor, createMockItem)),
    createDeleteTask: jest.fn().mockReturnValue(createMockTask(createMockActor, createMockItem)),
    createMoveTask: jest.fn().mockReturnValue(createMockTask(createMockActor, createMockItem)),
    createCopyTask: jest.fn().mockReturnValue(createMockTask(createMockActor, createMockItem)),
    createGetChildrenTask: jest.fn().mockReturnValue(createMockTask(createMockActor, createMockItemArray)),
    createGetOwnTask: jest.fn().mockReturnValue(createMockTask(createMockActor, createMockItemArray)),
    createGetSharedWithTask: jest.fn().mockReturnValue(createMockTask(createMockActor, createMockItemArray)),
};

const mockItemService: ItemService = {
    get: jest.fn().mockReturnValue(createPromise(createMockItem)),
    getMatchingPath: jest.fn().mockReturnValue(createPromise(createMockItem)),
    getMany: jest.fn().mockReturnValue(createPromise(createMockItemArray)),
    create: jest.fn().mockReturnValue(createPromise(createMockItem)),
    update: jest.fn().mockReturnValue(createPromise(createMockItem)),
    delete: jest.fn().mockReturnValue(createPromise(createMockItem)),
    getNumberOfChildren: jest.fn().mockReturnValue(0),
    getChildren: jest.fn().mockReturnValue(createPromise(createMockItemArray)),
    getNumberOfDescendants: jest.fn().mockReturnValue(0),
    getDescendants: jest.fn().mockReturnValue(createPromise(createMockItemArray)),
    getNumberOfLevelsToFarthestChild: jest.fn().mockReturnValue(0),
    getOwn: jest.fn().mockReturnValue(createPromise(createMockItemArray)),
    getSharedWith: jest.fn().mockReturnValue(createPromise(createMockItemArray)),
    move: jest.fn(),
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
    createCreateTask: jest.fn().mockReturnValue(createMockTask(createMockActor, createMockItemMembership)),
    createGetTask: jest.fn().mockReturnValue(createMockTask(createMockActor, createMockItemMembership)),
    createUpdateTask: jest.fn().mockReturnValue(createMockTask(createMockActor, createMockItemMembership)),
    createDeleteTask: jest.fn().mockReturnValue(createMockTask(createMockActor, createMockItemMembership)),
    createGetOfItemTask: jest.fn().mockReturnValue(createMockTask(createMockActor, createMockItemMembershipArray)),
};

const mockItemMembershipService: ItemMembershipService = {
    getPermissionLevel: jest.fn().mockReturnValue("admin"),
    getInherited: jest.fn().mockReturnValue(createPromise(createMockItemMembership)),
    getAllBelow: jest.fn().mockReturnValue(createPromise(createMockItemMembershipArray)),
    getInheritedForAll: jest.fn().mockReturnValue(createPromise(createMockItemMembershipArray)),
    canRead: jest.fn().mockReturnValue(true),
    canWrite: jest.fn().mockReturnValue(true),
    canAdmin: jest.fn().mockReturnValue(true),
    get: jest.fn().mockReturnValue(createPromise(createMockItemMembership)),
    create: jest.fn().mockReturnValue(createPromise(createMockItemMembership)),
    createMany: jest.fn().mockReturnValue(createPromise(createMockItemMembershipArray)),
    update: jest.fn().mockReturnValue(createPromise(createMockItemMembership)),
    delete: jest.fn().mockReturnValue(createPromise(createMockItemMembership)),
    deleteManyMatching: jest.fn().mockReturnValue(createPromise(createMockItemMembershipArray)),
    moveHousekeeping: jest.fn().mockReturnValue(createPromise(() => ({
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

export const createMockFastifyLogger = (): FastifyLoggerInstance => ({
    info: (...args: any[]) => { },
    warn: (...args: any[]) => { },
    error: (...args: any[]) => { },
    fatal: (...args: any[]) => { },
    trace: (...args: any[]) => { },
    debug: (...args: any[]) => { },
    child: (bindings) => createMockFastifyLogger(),
});

const mockHelpers: TaskHookHandlerHelpers = {
    log: createMockFastifyLogger(),
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
    runPre: <T>(taskName: string, param: T) => Promise.all(mockTaskRunnerState.handlers.pre.get(taskName)?.map(async h => await h(param, createMockActor(), mockHelpers)) ?? []),
    runPost: <T>(taskName: string, param: T) => Promise.all(mockTaskRunnerState.handlers.post.get(taskName)?.map(async h => await h(param, createMockActor(), mockHelpers)) ?? []),
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
export const mockValidateSession = jest.fn().mockReturnValue(Promise.resolve());