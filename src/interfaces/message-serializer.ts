/**
 * graasp-websockets
 *
 * Serdes interface that describes serialization / deserialization
 * operations between the WebSocket.Data messages exchanged on the
 * network and the data types used in the {@link WebSocketChannels}
 *
 * @author Alexandre CHAU
 */

import WebSocket from 'ws';

interface MessageSerializer<ClientMessageType, ServerMessageType> {
  /**
   * Serializes a server message into a raw WebSocket.Data message
   * @param object Server data to send to client
   * @returns a WebSocket.Data compatible raw message representation
   */
  serialize(object: ServerMessageType): WebSocket.Data;

  /**
   * Deserializes raw client data into a compatible message
   * @param data Client data received by server
   * @returns a ClientMessage or undefined if the parsing was unsuccessful
   */
  parse(data: WebSocket.Data): ClientMessageType | undefined;
}

export { MessageSerializer };
