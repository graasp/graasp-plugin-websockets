/**
 * graasp-websockets
 * 
 * JSON Type Definitions for {@link Message} types
 * See:
 *  https://ajv.js.org/guide/typescript.html
 *  https://ajv.js.org/json-type-definition.html
 * 
 * @author Alexandre CHAU
 */
import { JTDSchemaType } from "ajv-latest/dist/jtd";
import { ClientMessage, ServerMessage } from "../interfaces/message";

/**
 * Client message schema
 * MUST conform to {@link ClientMessage} (provide equivalent runtime types)
 */
const clientMessageSchema: JTDSchemaType<ClientMessage> = {
    discriminator: "action",
    mapping: {
        "disconnect": {
            properties: {
                realm: { enum: ["notif"] },
            },
        },
        "subscribe": {
            properties: {
                realm: { enum: ["notif"] },
                channel: { type: "string" },
                entity: { enum: ["item", "member"] },
            },
        },
        "unsubscribe": {
            properties: {
                realm: { enum: ["notif"] },
                channel: { type: "string" },
            },
        },
        "subscribeOnly": {
            properties: {
                realm: { enum: ["notif"] },
                channel: { type: "string" },
                entity: { enum: ["item", "member"] },
            },
        },
    },
};


/**
 * Server message schema
 * MUST conform to {@link ServerMessage} (provide equivalent runtime types)
 */
const serverMessageSchema: JTDSchemaType<ServerMessage> = {
    discriminator: "type",
    mapping: {
        "response": {
            properties: {
                realm: { enum: ["notif"] },
                status: { enum: ["success", "error"] },
            },
            optionalProperties: {
                error: {
                    properties: {
                        name: { enum: ["ACCESS_DENIED", "INVALID_REQUEST", "NOT_FOUND"] },
                        message: { type: "string" },
                    },
                },
                request: {
                    discriminator: "action",
                    mapping: {
                        "disconnect": {
                            properties: {
                                realm: { enum: ["notif"] },
                            },
                        },
                        "subscribe": {
                            properties: {
                                realm: { enum: ["notif"] },
                                channel: { type: "string" },
                                entity: { enum: ["item", "member"] },
                            },
                        },
                        "unsubscribe": {
                            properties: {
                                realm: { enum: ["notif"] },
                                channel: { type: "string" },
                            },
                        },
                        "subscribeOnly": {
                            properties: {
                                realm: { enum: ["notif"] },
                                channel: { type: "string" },
                                entity: { enum: ["item", "member"] },
                            },
                        },
                    },
                },
            },
        },
        "info": {
            properties: {
                realm: { enum: ["notif"] },
                message: { type: "string" },
            },
            optionalProperties: {
                extra: {},
            },
        },
        "update": {
            properties: {
                realm: { enum: ["notif"] },
                channel: { type: "string" },
                body: {
                    discriminator: "entity",
                    mapping: {
                        "item": {
                            properties: {
                                kind: { enum: ["childItem"] },
                                operation: { enum: ["create", "delete"] },
                            },
                            optionalProperties: {
                                value: {},
                            }
                        },
                        "member": {
                            properties: {
                                kind: { enum: ["sharedWith"] },
                                operation: { enum: ["create", "delete"] },
                            },
                            optionalProperties: {
                                value: {},
                            }
                        },
                    },
                },
            },
        },
    },
};

export { clientMessageSchema, serverMessageSchema };
