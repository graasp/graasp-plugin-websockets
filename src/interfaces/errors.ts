/**
 * Error type thrown when a client subscription is rejected
 */
export interface SubscriptionError {
  name: 'ACCESS_DENIED' | 'BAD_REQUEST' | 'NOT_FOUND' | 'SERVER_ERROR';
  message: string;
}
