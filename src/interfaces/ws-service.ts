import { Member, UnknownExtra } from 'graasp';
import { SubscriptionError } from './errors';

/**
 * Public WebSocket service exposed to other consumers on the server
 * (e.g. other services that want to publish messages using websockets)
 */
export interface WebSocketService {
  /**
   * Registers a topic (a group of related channels) dedicated to the caller
   * @param topic topic name, must be unique across server
   * @param validateClient a function called when a client attempts to
   *    subscribe to a channel of the topic, which must accept the subscription
   *    or reject by calling the corresponding parameter with a subscription
   *    error @see {SubscriptionError}
   */
  register(
    topic: string,
    validateClient: (
      channel: string,
      member: Member<UnknownExtra>,
      reject: (error: SubscriptionError) => void,
    ) => void,
  );

  /**
   * Publishes a message on a channel globally (incl. across server instances)
   * @param topic topic name
   * @param channel channel name
   * @param message message to publish
   */
  publish<Message>(topic: string, channel: string, message: Message);

  /**
   * Publishes a message on a channel locally (i.e. on this specific server
   * instance only)
   * @param topic topic name
   * @param channel channel name
   * @param message message to publish
   */
  publishLocal<Message>(topic: string, channel: string, message: Message);
}
