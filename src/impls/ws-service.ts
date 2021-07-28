import { Member, UnknownExtra } from 'graasp';
import WebSocket from 'ws';
import {
  CLIENT_ACTION_DISCONNECT,
  CLIENT_ACTION_SUBSCRIBE,
  CLIENT_ACTION_SUBSCRIBE_ONLY,
  CLIENT_ACTION_UNSUBSCRIBE,
} from '../interfaces/constants';
import {
  BadRequest,
  Error,
  isError as isSubscriptionError,
  NotFound,
  ServerError,
} from '../interfaces/error';
import { Logger } from '../interfaces/logger';
import {
  ClientMessage,
  ClientSubscribe,
  ClientSubscribeOnly,
  createServerErrorResponse,
  createServerSuccessResponse,
  createServerUpdate,
  ServerMessage,
} from '../interfaces/message';
import { SubscriptionRequest } from '../interfaces/request';
import { WebSocketService } from '../interfaces/ws-service';
import { MultiInstanceChannelsBroker } from '../multi-instance';
import { WebSocketChannels } from '../ws-channels';

type ValidationFn = (request: SubscriptionRequest) => Promise<void>;

/**
 * Concrete implementation of the WebSocket service
 * Provides WebSocket connectivity to the rest of the server
 * @see {WebSocketService}
 */
export class Service implements WebSocketService {
  // store for validation functions indexed by topic
  private validators: Map<string, ValidationFn> = new Map();
  // channels abstraction reference
  private wsChannels: WebSocketChannels;
  // multi-instance channels broker reference (to send across servers cluster)
  private wsMultiBroker: MultiInstanceChannelsBroker;
  // parser function that converts raw client websocket data into JS
  private parse: (data: WebSocket.Data) => ClientMessage | undefined;
  // logger
  private logger: Logger;

  constructor(
    wsChannels: WebSocketChannels,
    wsMultiBroker: MultiInstanceChannelsBroker,
    parse: (data: WebSocket.Data) => ClientMessage | undefined,
    log: Logger,
  ) {
    this.wsChannels = wsChannels;
    this.wsMultiBroker = wsMultiBroker;
    this.parse = parse;
    this.logger = log;
  }

  register(topic: string, validateClient: ValidationFn): this {
    this.validators.set(topic, validateClient);
    return this;
  }

  publish<Message>(topic: string, channel: string, message: Message) {
    this.wsMultiBroker.dispatch(
      channel,
      createServerUpdate(topic, channel, message),
    );
  }

  publishLocal<Message>(topic: string, channel: string, message: Message) {
    this.wsChannels.channelSend(
      channel,
      createServerUpdate(topic, channel, message),
    );
  }

  // Helper to handle client subscribe and subscribeOnly actions
  private async handleSubscribe(
    request: ClientSubscribe | ClientSubscribeOnly,
    member: Member<UnknownExtra>,
    client: WebSocket,
    subscribeFn: (client: WebSocket, channelName: string) => boolean,
  ) {
    let res: ServerMessage;

    const validate = this.validators.get(request.topic);
    if (validate === undefined) {
      res = createServerErrorResponse(NotFound(), request);
    } else {
      try {
        validate({
          channel: request.channel,
          member,
          // allow consumer to reject valiation by throwing an error
          reject: (error: Error) => {
            throw error;
          },
        });

        // no throw so user is allowed, create channel if needed
        if (!this.wsChannels.channels.has(request.channel)) {
          this.wsChannels.channelCreate(request.channel, true);
        }

        res = subscribeFn(client, request.channel)
          ? createServerSuccessResponse(request)
          : createServerErrorResponse(NotFound(), request);
      } catch (error) {
        if (isSubscriptionError(error)) {
          // this is our validation error type, simply reply
          res = createServerErrorResponse(error, request);
        } else {
          // something else went wrong, log and wrap
          this.logger.error(
            `graasp-websockets: unexpected validation error: ${error}`,
          );
          const err = ServerError('unexpected validation error');
          res = createServerErrorResponse(err, request);
        }
      }
    }

    this.wsChannels.clientSend(client, res);
  }

  /**
   * Handles incoming client websocket requests according to the
   * Graasp WebSocket protocol
   * @param data raw websocket data sent from client
   * @param member member performing the request
   * @param socket client socket
   */
  handleRequest(
    data: WebSocket.Data,
    member: Member<UnknownExtra>,
    client: WebSocket,
  ) {
    const request = this.parse(data);

    // validation error, send bad request
    if (request === undefined) {
      const err = BadRequest();
      return this.wsChannels.clientSend(client, createServerErrorResponse(err));
    }

    // request is now type-safe as ClientMessage
    switch (request.action) {
      case CLIENT_ACTION_DISCONNECT: {
        this.wsChannels.clientRemove(client);
        break;
      }
      case CLIENT_ACTION_SUBSCRIBE: {
        this.handleSubscribe(
          request,
          member,
          client,
          this.wsChannels.clientSubscribe,
        );
        break;
      }
      case CLIENT_ACTION_SUBSCRIBE_ONLY: {
        this.handleSubscribe(
          request,
          member,
          client,
          this.wsChannels.clientSubscribeOnly,
        );
        break;
      }
      case CLIENT_ACTION_UNSUBSCRIBE: {
        const res = this.wsChannels.clientUnsubscribe(client, request.channel)
          ? createServerSuccessResponse(request)
          : createServerErrorResponse(NotFound(), request);
        this.wsChannels.clientSend(client, res);
        // preemptively remove channel if empty
        this.wsChannels.channelDelete(request.channel, true);
        break;
      }
    }
  }
}
