import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { ChatAgentService, ConfirmationHandler } from './chat-agent.service';
import { randomUUID } from 'crypto';

/** How long (ms) to wait for a user confirmation before auto-denying. */
const CONFIRMATION_TIMEOUT_MS = 60_000;

@WebSocketGateway({
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'http://localhost:3001',
    ],
    credentials: true,
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  /**
   * Pending confirmation promises keyed by socket ID, then confirmation ID.
   * Supports multiple concurrent confirmations per connection.
   * Outer Map: clientId → Inner Map
   * Inner Map: confirmationId → resolve function
   */
  private pendingConfirmations = new Map<string, Map<string, (confirmed: boolean) => void>>();
  /** userId → active Socket — used by IoTGatewayService to push messages. */
  private userSockets = new Map<string, Socket>();

  constructor(
    private chatAgent: ChatAgentService,
    private jwtService: JwtService,
  ) {}

  handleConnection(client: Socket) {
    try {
      // Extract JWT token from handshake (either from auth.token or authorization header)
      const token =
        client.handshake.auth.token ||
        client.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        this.logger.warn(`Connection rejected - no token provided: ${client.id}`);
        client.disconnect();
        return;
      }

      // Verify JWT token
      const payload = this.jwtService.verify(token);

      // Store authenticated user data in socket
      client.data.userId = payload.sub;
      client.data.userRole = payload.role;
      client.data.userEmail = payload.email;

      // Register user socket for push notifications
      this.userSockets.set(payload.sub, client);

      this.logger.debug(
        `Client authenticated: ${client.id}, userId: ${payload.sub}, role: ${payload.role}`,
      );
    } catch (error) {
      this.logger.error(`Authentication failed for ${client.id}: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    try {
      this.logger.debug(`Client disconnected: ${client.id}`);

      // Remove from userId→socket mapping
      for (const [uid, socket] of this.userSockets.entries()) {
        if (socket.id === client.id) {
          this.userSockets.delete(uid);
          break;
        }
      }

      // Auto-deny all pending confirmations so the generator can unblock and clean up
      const clientConfirmations = this.pendingConfirmations.get(client.id);
      if (clientConfirmations) {
        // Resolve all pending confirmations with false
        for (const resolve of clientConfirmations.values()) {
          resolve(false);
        }
        this.pendingConfirmations.delete(client.id);
      }
    } catch (error) {
      this.logger.error('Error during disconnect:', error);
    }
  }

  // ─── Main chat handler ───────────────────────────────────────────────────

  @SubscribeMessage('chat')
  async handleChat(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      message: string;
      sessionId?: string;
      context?: any;
    },
  ) {
    try {
      // Use authenticated userId from socket data (set during connection)
      const userId = client.data.userId;

      if (!userId) {
        client.emit('chat_error', { error: 'Not authenticated' });
        this.logger.error(`Unauthenticated chat attempt from ${client.id}`);
        return;
      }

      this.logger.debug(`Received chat message from ${client.id}, user: ${userId}`);

      /**
       * Confirmation handler injected into the agentic loop.
       *
       * When a confirmation gate is hit the loop awaits this function.
       * We emit `chat_confirmation` to the client and return a Promise
       * that resolves when the client sends back `confirm_response`.
       * A 60 s timeout auto-denies if the user doesn't respond.
       */
      const confirmHandler: ConfirmationHandler = (toolName, toolInput, message) => {
        return new Promise<boolean>((resolve, reject) => {
          // Generate unique confirmation ID
          const confirmationId = randomUUID();

          // Ensure nested Map exists for this client
          if (!this.pendingConfirmations.has(client.id)) {
            this.pendingConfirmations.set(client.id, new Map());
          }

          // Store resolve function with unique ID
          this.pendingConfirmations.get(client.id)!.set(confirmationId, resolve);

          // Emit confirmation request with ID
          client.emit('chat_confirmation', {
            confirmationId,
            toolName,
            toolInput,
            message,
          });

          // Safety timeout — auto-deny after CONFIRMATION_TIMEOUT_MS
          setTimeout(() => {
            const clientConfirmations = this.pendingConfirmations.get(client.id);
            if (clientConfirmations?.has(confirmationId)) {
              clientConfirmations.delete(confirmationId);

              // Clean up empty Maps
              if (clientConfirmations.size === 0) {
                this.pendingConfirmations.delete(client.id);
              }

              reject(new Error('Confirmation timeout'));
            }
          }, CONFIRMATION_TIMEOUT_MS);
        });
      };

      // Iterate the agentic loop, mapping each typed event to the
      // appropriate Socket.io emission.
      let sessionId: string | undefined;

      for await (const event of this.chatAgent.chatStreamAgentic(
        data.message,
        data.sessionId,
        userId, // Use authenticated userId from socket, not from client data
        confirmHandler,
      )) {
        switch (event.type) {
          case 'text':
            client.emit('chat_chunk', { chunk: event.content });
            break;

          case 'thinking':
            client.emit('chat_thinking');
            break;

          case 'tool_start':
            client.emit('tool_start', { toolName: event.toolName, toolInput: event.toolInput });
            break;

          case 'tool_result':
            client.emit('tool_result', { toolName: event.toolName, result: event.result });
            break;

          case 'cart_action':
            client.emit('cart_action', {
              action: event.action,
              productId: event.productId,
              quantity: event.quantity,
              name: event.name,
              price: event.price,
            });
            break;

          case 'confirmation_request':
            // The confirmation event was already emitted inside confirmHandler
            // when onConfirmation() was called.  Nothing extra needed here.
            break;

          case 'session':
            sessionId = event.sessionId;
            break;

          case 'error':
            client.emit('chat_error', { error: event.message });
            break;
        }
      }

      // Signal completion with the session ID and expiry time
      // Fetch session expiry time
      let expiresAt: Date | null = null;
      if (sessionId) {
        try {
          const sessionData = await this.chatAgent['sessionService'].getSession(sessionId);
          expiresAt = sessionData?.expiresAt || null;
        } catch (err) {
          this.logger.warn(`Could not fetch session expiry: ${err.message}`);
        }
      }

      client.emit('chat_complete', { sessionId, expiresAt });
    } catch (error) {
      this.logger.error(`Chat error: ${error.message}`, error.stack);

      // Clean up any pending confirmations
      const clientConfirmations = this.pendingConfirmations.get(client.id);
      if (clientConfirmations) {
        // Resolve all with false to unblock the agentic loop
        for (const resolve of clientConfirmations.values()) {
          resolve(false);
        }
        this.pendingConfirmations.delete(client.id);
      }

      client.emit('chat_error', { error: error.message });
    }
  }

  // ─── Confirmation response ───────────────────────────────────────────────

  /**
   * Client sends this after receiving a `chat_confirmation` event.
   * Resolves the pending confirmation Promise in the agentic loop,
   * allowing it to either execute or skip the gated tool call.
   */
  @SubscribeMessage('confirm_response')
  handleConfirmResponse(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { confirmationId: string; confirmed: boolean },
  ) {
    const clientConfirmations = this.pendingConfirmations.get(client.id);
    if (clientConfirmations) {
      const resolve = clientConfirmations.get(data.confirmationId);
      if (resolve) {
        clientConfirmations.delete(data.confirmationId);

        // Clean up empty Maps
        if (clientConfirmations.size === 0) {
          this.pendingConfirmations.delete(client.id);
        }

        resolve(data.confirmed);
      }
    }
  }

  // ─── IoT push ─────────────────────────────────────────────────────────────

  /**
   * Push an IoT-injected message to a user's active chat socket.
   * Called by IoTGatewayService when an MQTT event produces an injection.
   */
  pushIoTMessage(userId: string, message: string) {
    const socket = this.userSockets.get(userId);
    if (socket) {
      socket.emit('iot_message', { message });
    }
  }

  // ─── Health ──────────────────────────────────────────────────────────────

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    client.emit('pong');
  }
}
