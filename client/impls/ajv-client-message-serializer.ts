/**
 * graasp-websockets
 *
 * Concrete message serdes with Ajv and JSON Type Definitions.
 * See:
 *  https://ajv.js.org/guide/getting-started.html#parsing-and-serializing-json
 *  https://ajv.js.org/guide/typescript.html
 *
 * This is the dual interface of {@link AjvMessageSerializer} (server)
 * but for clients (types are reversed). NOTE: both implementations
 * need to be compatible (e.g. both should convert to JSON)!
 *
 * @author Alexandre CHAU
 */
import Ajv from 'ajv-latest/dist/jtd';
import { ClientMessage, ServerMessage } from '../../src/interfaces/message';
import { clientMessageSchema, serverMessageSchema } from '../../src/schemas/message-schema';
import { ClientMessageSerializer } from '../interfaces/client-message-serializer';

const ajv = new Ajv();

class AjvClientMessageSerializer implements ClientMessageSerializer {
    /** @inheritdoc */
    serialize = ajv.compileSerializer<ClientMessage>(clientMessageSchema);

    /** @inheritdoc */
    parse = ajv.compileParser<ServerMessage>(serverMessageSchema);
}

export { AjvClientMessageSerializer };
