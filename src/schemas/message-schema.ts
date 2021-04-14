/**
 * graasp-websockets
 * 
 * JSON Type Definitions for {@link ClientMessage} types
 * See:
 *  https://ajv.js.org/guide/typescript.html
 *  https://ajv.js.org/json-type-definition.html
 * 
 * @author Alexandre CHAU
 */
import { JTDSchemaType } from "ajv-latest/dist/jtd";
import { ClientMessage, ServerMessage } from "../interfaces/message";

const clientMessageSchema: JTDSchemaType<ClientMessage> = {
    discriminator: "action",
    mapping: {
        "disconnect": {
            properties: {
                realm: { enum: ["notif"] },
            }
        },
        "subscribe": {
            properties: {
                realm: { enum: ["notif"] },
                channel: { type: "string" }
            }
        },
        "unsubscribe": {
            properties: {
                realm: { enum: ["notif"] },
                channel: { type: "string" }
            }
        },
        "subscribeOnly": {
            properties: {
                realm: { enum: ["notif"] },
                channel: { type: "string" }
            }
        }
    }
};

const serverMessageSchema: JTDSchemaType<ServerMessage> = {
    properties: {
        realm: { enum: ["notif"] }
    },
    optionalProperties: {
        error: {
            properties: {
                name: { type: "string" },
                message: { type: "string" },
            },
        },
        body: {},
    },
};

export { clientMessageSchema, serverMessageSchema };
