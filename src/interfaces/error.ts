import {
  ERROR_ACCESS_DENIED,
  ERROR_BAD_REQUEST,
  ERROR_NOT_FOUND,
  ERROR_SERVER_ERROR,
} from './constants';

/**
 * Error type thrown when a client subscription is rejected
 */
export interface Error {
  name:
    | typeof ERROR_ACCESS_DENIED
    | typeof ERROR_BAD_REQUEST
    | typeof ERROR_NOT_FOUND
    | typeof ERROR_SERVER_ERROR;
  message: string;
}

/**
 * Type guard for {@link Error} type
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
export const isError = (data: any): data is Error => {
  return (
    data &&
    data.name &&
    (data.name === ERROR_ACCESS_DENIED ||
      data.name === ERROR_BAD_REQUEST ||
      data.name === ERROR_NOT_FOUND ||
      data.name === ERROR_SERVER_ERROR) &&
    data.message &&
    typeof data.message === 'string'
  );
};

/**
 * Access denied error factory
 */
export const AccessDenied = (): Error => ({
  name: ERROR_ACCESS_DENIED,
  message: 'Access denied for the requested resource',
});

/**
 * Bad request error factory
 */
export const BadRequest = (): Error => ({
  name: ERROR_BAD_REQUEST,
  message: 'Request message format was not understood by the server',
});

/**
 * Not found error factory
 */
export const NotFound = (): Error => ({
  name: ERROR_NOT_FOUND,
  message: 'Requested resource not found',
});

/**
 * Internal server error factory
 */
export const ServerError = (message: string): Error => ({
  name: ERROR_SERVER_ERROR,
  message: `Internal server error: ${message}`,
});
