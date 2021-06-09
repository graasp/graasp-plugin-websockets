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

const mockItemTaskManager = {
    getCreateTaskName: () => "create",
    getGetTaskName: () => "get",
    getUpdateTaskName: () => "update",
    getDeleteTaskName: () => "delete",
    getMoveTaskName: () => "move",
    getCopyTaskName: () => "copy",
    getGetChildrenTaskName: () => "getChildren",
    getGetOwnTaskName: () => "getOwn",
    getGetSharedWithTaskName: () => "getSharedWith",
};

const mockItemMembershipTaskManager = {
    getCreateTaskName: () => "create",
    getGetTaskName: () => "get",
    getUpdateTaskName: () => "update",
    getDeleteTaskName: () => "delete",
    getGetOfItemTaskName: () => "getOfItem",
};

export const mockItemsManager = {
    taskManager: mockItemTaskManager,
};

export const mockItemMembershipsManager = {
    taskManager: mockItemMembershipTaskManager,
};

export const mockTaskRunner = {
    setTaskPreHookHandler: (taskName, handler) => { },
    setTaskPostHookHandler: (taskName, handler) => { },
};