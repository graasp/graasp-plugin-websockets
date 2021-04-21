/**
 * graasp-websockets
 * 
 * Concrete message serdes with Ajv and JSON Type Definitions.
 * See:
 *  https://ajv.js.org/guide/getting-started.html#parsing-and-serializing-json
 *  https://ajv.js.org/guide/typescript.html
 * 
 * @author Alexandre CHAU
 */
import Ajv from 'ajv-latest/dist/jtd';
import { MessageSerializer } from '../interfaces/message-serializer';
import { clientMessageSchema, serverMessageSchema } from '../schemas/message-schema';

const ajv = new Ajv();

class AjvMessageSerializer<ClientMessageType, ServerMessageType> implements MessageSerializer<ClientMessageType, ServerMessageType> {
    /** @inheritdoc */
    serialize = ajv.compileSerializer<ServerMessageType>(serverMessageSchema);

    /** @inheritdoc */
    parse = ajv.compileParser<ClientMessageType>(clientMessageSchema);
}

export { AjvMessageSerializer };
