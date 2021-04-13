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
    properties: {
        type: { enum: ["notif"] }
    },
    discriminator: "action",
    mappings: {
        "disconnect": {},
        "subscribe": {
            properties: {
                channel: { type: "string" }
            }
        },
        "unsubscribe": {
            properties: {
                channel: { type: "string" }
            }
        },
        "subscribeOnly": {
            properties: {
                channel: { type: "string" }
            }
        }
    }
};

export { clientMessageSchema };
