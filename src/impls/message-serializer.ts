/**
 * Concrete message serdes with Ajv and JSON Type Definitions.
 * See:
 *  https://ajv.js.org/guide/getting-started.html#parsing-and-serializing-json
 *  https://ajv.js.org/guide/typescript.html
 */
import Ajv from 'ajv/dist/jtd';
import { ClientMessage, ServerMessage } from '../interfaces/message';
import { MessageSerializer } from '../interfaces/message-serializer';
import { clientMessageSchema, serverMessageSchema } from '../schemas';

const ajv = new Ajv();

class AjvMessageSerializer implements MessageSerializer {
  /** @inheritdoc */
  serialize = ajv.compileSerializer<ServerMessage>(serverMessageSchema);

  /** @inheritdoc */
  parse = ajv.compileParser<ClientMessage>(clientMessageSchema);
}

export { AjvMessageSerializer };
