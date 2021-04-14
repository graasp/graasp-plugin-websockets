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
import { ClientMessage } from "../interfaces/message";

const clientMessageSchema: JTDSchemaType<ClientMessage> = {
    discriminator: "action",
    mapping: {
        "disconnect": {
            properties: {
                type: { enum: ["notif"] },
            }
        },
        "subscribe": {
            properties: {
                type: { enum: ["notif"] },
                channel: { type: "string" }
            }
        },
        "unsubscribe": {
            properties: {
                type: { enum: ["notif"] },
                channel: { type: "string" }
            }
        },
        "subscribeOnly": {
            properties: {
                type: { enum: ["notif"] },
                channel: { type: "string" }
            }
        }
    }
};

export { clientMessageSchema };
