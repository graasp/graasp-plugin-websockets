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


/**
 * Server message schema
 * MUST conform to {@link ServerMessage} (provide equivalent runtime types)
 */
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
