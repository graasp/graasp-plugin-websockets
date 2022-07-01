import WebSocket from 'ws';

import { Member, UnknownExtra } from 'graasp';

import {
  CLIENT_ACTION_DISCONNECT,
  CLIENT_ACTION_SUBSCRIBE,
  CLIENT_ACTION_SUBSCRIBE_ONLY,
  CLIENT_ACTION_UNSUBSCRIBE,
} from '../interfaces/constants';
import {
  BadRequest,
  Error,
  NotFound,
  ServerError,
  isError as isSubscriptionError,
} from '../interfaces/error';
import { Logger } from '../interfaces/logger';
import {
  ClientMessage,
  ClientSubscribe,
  ClientSubscribeOnly,
  ClientUnsubscribe,
  ServerMessage,
  createServerErrorResponse,
  createServerSuccessResponse,
  createServerUpdate,
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

  /**
   * Helper to scope channel by topic
   * @param channel public channel name
   * @param topic topic into which the channel should be scoped
   * @returns low-level unique channel name that includes scoping information
   */
  private scope(channel: string, topic: string): string {
    if (channel === 'broadcast') {
      return channel;
    }
    return `${topic}/${channel}`;
  }

  /**
   * Helper to handle client subscribe and subscribeOnly actions
   */
  private async handleSubscribe(
    request: ClientSubscribe | ClientSubscribeOnly,
    member: Member<UnknownExtra>,
    client: WebSocket,
    subscribeFn: (client: WebSocket, channelName: string) => boolean,
  ) {
    let res: ServerMessage;

    const validate = this.validators.get(request.topic);
    if (validate === undefined) {
      this.logger.info(
        `graasp-websockets: Validator not found for topic ${request.topic}`,
      );
      res = createServerErrorResponse(NotFound(), request);
    } else {
      try {
        await validate({
          channel: request.channel,
          member,
          // allow consumer to reject valiation by throwing an error
          reject: (error: Error) => {
            throw error;
          },
        });

        // scope channel into topic
        const scopedChannel = this.scope(request.channel, request.topic);

        // no throw so user is allowed, create channel if needed
        if (!this.wsChannels.channels.has(scopedChannel)) {
          this.wsChannels.channelCreate(scopedChannel, true);
        }

        res = subscribeFn(client, scopedChannel)
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
   * Helper to handle unsubscribe action
   */
  private handleUnsubscribe(request: ClientUnsubscribe, client: WebSocket) {
    // scope channel into topic
    const scopedChannel = this.scope(request.channel, request.topic);
    const res = this.wsChannels.clientUnsubscribe(client, scopedChannel)
      ? createServerSuccessResponse(request)
      : createServerErrorResponse(NotFound(), request);
    this.wsChannels.clientSend(client, res);
    // preemptively remove channel if empty
    this.wsChannels.channelDelete(scopedChannel, true);
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
  ): void {
    const request = this.parse(data);

    // validation error, send bad request
    if (request === undefined) {
      this.logger.info(
        `graasp-websockets: Bad client request (memberID: ${member.id}, message: ${data})`,
      );
      const err = BadRequest();
      this.wsChannels.clientSend(client, createServerErrorResponse(err));
      return;
    }

    // request is now type-safe as ClientMessage
    switch (request.action) {
      case CLIENT_ACTION_DISCONNECT: {
        this.wsChannels.clientRemove(client);
        break;
      }
      case CLIENT_ACTION_SUBSCRIBE: {
        this.handleSubscribe(request, member, client, (client, channel) =>
          this.wsChannels.clientSubscribe(client, channel),
        );
        break;
      }
      case CLIENT_ACTION_SUBSCRIBE_ONLY: {
        this.handleSubscribe(request, member, client, (client, channel) =>
          this.wsChannels.clientSubscribeOnly(client, channel),
        );
        break;
      }
      case CLIENT_ACTION_UNSUBSCRIBE: {
        this.handleUnsubscribe(request, client);
        break;
      }
    }
  }

  register(topic: string, validateClient: ValidationFn): this {
    if (this.validators.has(topic)) {
      this.logger.error(
        `graasp-websockets: Topic ${topic} is already registered`,
      );
      throw new Error('WebSocketService.register: topic already exists!');
    }
    this.validators.set(topic, validateClient);
    return this;
  }

  publish<Message>(topic: string, channel: string, message: Message): void {
    // scope channel into topic
    const scopedChannel = this.scope(channel, topic);
    this.wsMultiBroker.dispatch(
      scopedChannel,
      createServerUpdate(topic, channel, message),
    );
  }

  publishLocal<Message>(
    topic: string,
    channel: string,
    message: Message,
  ): void {
    // scope channel into topic
    const scopedChannel = this.scope(channel, topic);
    this.wsChannels.channelSend(
      scopedChannel,
      createServerUpdate(topic, channel, message),
    );
  }
}
