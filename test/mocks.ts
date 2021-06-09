/**
 * graasp-websockets
 * 
 * Mock instances for testing in graasp-websockets
 * 
 * @author Alexandre CHAU
 */

/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */


import { Actor, Item, ItemMembership, ItemMembershipService, ItemMembershipTaskManager, ItemService, ItemTaskManager, PermissionLevel, Task, TaskRunner, UnknownExtra } from "graasp";

const createPromise = <T>(createFn: () => T) => new Promise<T>((resolve, reject) => resolve(createFn()));

const createMockTask = <T>(name: string, actor: Actor): Task<Actor, T> => ({
    name: name,
    actor: actor,
    status: 'NEW',
    result: null,
    run: (handler, log) => createPromise(() => { })
});

const mockItemTaskManager: ItemTaskManager = {
    getCreateTaskName: () => "create",
    getGetTaskName: () => "get",
    getUpdateTaskName: () => "update",
    getDeleteTaskName: () => "delete",
    getMoveTaskName: () => "move",
    getCopyTaskName: () => "copy",
    getGetChildrenTaskName: () => "getChildren",
    getGetOwnTaskName: () => "getOwn",
    getGetSharedWithTaskName: () => "getSharedWith",
    createCreateTask: (actor, object) => createMockTask("create", actor),
    createGetTask: (actor, objectId) => createMockTask("get", actor),
    createUpdateTask: (actor, objectId, object) => createMockTask("update", actor),
    createDeleteTask: (actor, objectId, extra) => createMockTask("delete", actor),
    createMoveTask: (actor, itemId, parentId) => createMockTask("move", actor),
    createCopyTask: (actor, itemId, parentId) => createMockTask("copy", actor),
    createGetChildrenTask: (actor, itemId) => createMockTask("getChildren", actor),
    createGetOwnTask: (actor) => createMockTask("ownTask", actor),
    createGetSharedWithTask: (actor) => createMockTask("sharedWith", actor)
};

const createMockItem = <E extends UnknownExtra>(): Item<E> => ({
    id: "mock",
    name: "mock",
    description: "mock",
    type: "mock",
    path: "mock",
    extra: null,
    creator: "mock",
    createdAt: "mock",
    updatedAt: "mock",
});

const createMockItemPromise = <E extends UnknownExtra>(): Promise<Item<E>> => createPromise(() => createMockItem<E>());

const createMockItemArrayPromise = () => Promise.all([createMockItemPromise()]);

const mockItemService: ItemService = {
    get: (id, transactionHandler) => createMockItemPromise(),
    getMatchingPath: (path, transactionHandler) => createMockItemPromise(),
    getMany: (ids, transactionHandler) => createMockItemArrayPromise(),
    create: (item, transactionHandler) => createMockItemPromise(),
    update: (id, data, transactionHandler) => createMockItemPromise(),
    delete: (id, transactionHandler) => createMockItemPromise(),
    getNumberOfChildren: (id, transactionHandler) => createPromise(() => 0),
    getChildren: (item, transactionHandler) => createMockItemArrayPromise(),
    getNumberOfDescendants: (item, transactionHandler) => createPromise(() => 0),
    getDescendants: (item, transactionHandler) => createMockItemArrayPromise(),
    getNumberOfLevelsToFarthestChild: (item, transactionHandler) => createPromise(() => 0),
    getOwn: (memberId, transactionHandler) => createMockItemArrayPromise(),
    getSharedWith: (memberId, transactionHandler) => createMockItemArrayPromise(),
    move: (item, transactionHandler, parentItem) => createPromise(() => { }),
};

const mockItemMembershipTaskManager: ItemMembershipTaskManager = {
    getCreateTaskName: () => "create",
    getGetTaskName: () => "get",
    getUpdateTaskName: () => "update",
    getDeleteTaskName: () => "delete",
    getGetOfItemTaskName: () => "getOfItem",
    createCreateTask: (actor, object) => createMockTask("create", actor),
    createGetTask: (actor, objectId) => createMockTask("get", actor),
    createUpdateTask: (actor, objectId, object) => createMockTask("update", actor),
    createDeleteTask: (actor, objectId) => createMockTask("delete", actor),
    createGetOfItemTask: (actor, itemId) => createMockTask("getOfItem", actor),
};

const createMockItemMembership = (): ItemMembership => ({
    id: "mock",
    memberId: "mock",
    itemPath: "mock",
    permission: PermissionLevel.Admin,
    creator: "mock",
    createdAt: "mock",
    updatedAt: "mock",
});

const createMockPermissionLevelPromise = () => createPromise(() => PermissionLevel.Admin);

const createMockItemMembershipPromise = () => createPromise(() => createMockItemMembership());

const createMockItemMembershipArrayPromise = () => Promise.all([createMockItemMembershipPromise()]);

const mockItemMembershipService: ItemMembershipService = {
    getPermissionLevel: (memberId, item, transactionHandler) => createMockPermissionLevelPromise(),
    getInherited: (memberId, item, transactionHandler) => createMockItemMembershipPromise(),
    getAllBelow: (memberId, item, transactionHandler) => createMockItemMembershipArrayPromise(),
    getInheritedForAll: (item, transactionHandler) => createMockItemMembershipArrayPromise(),
    canRead: (memberId, item, transactionHandler) => createPromise(() => true),
    canWrite: (memberId, item, transactionHandler) => createPromise(() => true),
    canAdmin: (memberId, item, transactionHandler) => createPromise(() => true),
    get: (id, transactionHandler) => createMockItemMembershipPromise(),
    create: (membership, transactionHandler) => createMockItemMembershipPromise(),
    createMany: (memberships, transactionHandler) => createMockItemMembershipArrayPromise(),
    update: (id, permission, transactionHandler) => createMockItemMembershipPromise(),
    delete: (id, transactionHandler) => createMockItemMembershipPromise(),
    deleteManyMatching: (memberships, transactionHandler) => createMockItemMembershipArrayPromise(),
    moveHousekeeping: (item, member, transactionHandler) => createPromise(() => ({ inserts: [createMockItemMembership()], deletes: [createMockItemMembership()] })),
    ...{} as any,
};

export const mockItemsManager = {
    taskManager: mockItemTaskManager,
    dbService: mockItemService,
    extendCreateSchema: _ => { },
    extendExtrasUpdateSchema: _ => { },
};

export const mockItemMembershipsManager = {
    taskManager: mockItemMembershipTaskManager,
    dbService: mockItemMembershipService,
};

export const mockTaskRunner: TaskRunner<Actor> = {
    runSingle: <T>(task: Task<Actor, T>) => createPromise(() => task.result),
    runMultiple: (tasks: Task<Actor, unknown>[]) => createPromise(() => tasks.map(t => t.result)),
    setTaskPreHookHandler: (taskName, handler) => { },
    setTaskPostHookHandler: (taskName, handler) => { },
    unsetTaskPreHookHandler: (taskName, handler) => { },
    unsetTaskPostHookHandler: (taskName, handler) => { },
};