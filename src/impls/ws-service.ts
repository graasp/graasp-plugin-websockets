import { Member, UnknownExtra } from 'graasp';
import { SubscriptionError } from '../interfaces/errors';
import { WebSocketService } from '../interfaces/ws-service';

/**
 * Concrete implementation of the WebSocket service
 * Provides WebSocket connectivity to the rest of the server
 * @see {WebSocketService}
 */
export class Service implements WebSocketService {
  register(
    topic: string,
    validateClient: (
      channel: string,
      member: Member<UnknownExtra>,
      reject: (error: SubscriptionError) => void,
    ) => void,
  ) {
    throw new Error('Method not implemented.');
  }

  publish<Message>(topic: string, channel: string, message: Message) {
    throw new Error('Method not implemented.');
  }

  publishLocal<Message>(topic: string, channel: string, message: Message) {
    throw new Error('Method not implemented.');
  }
}
