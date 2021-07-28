import { JTDSchemaType } from 'ajv/dist/jtd';
import { Error } from '../interfaces/error';

/**
 * Error schema
 * MUST conform to {@link Error} (provide equivalent runtime types)
 */
export const errorSchema: JTDSchemaType<Error> = {
  properties: {
    name: {
      enum: ['ACCESS_DENIED', 'BAD_REQUEST', 'NOT_FOUND', 'SERVER_ERROR'],
    },
    message: { type: 'string' },
  },
};
