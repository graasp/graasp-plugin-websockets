import { Member, UnknownExtra } from 'graasp';
import { Error } from './error';

/**
 * Request type when clients attempt to subscribe to some channel
 */
export interface SubscriptionRequest {
  /**
   * Subscription target channel name
   */
  channel: string;
  /**
   * Member requesting a subscription
   */
  member: Member<UnknownExtra>;
  /**
   * Rejects the subscription request with a specified error
   * @see {SubscriptionError}
   */
  reject(error: Error): void;
}
