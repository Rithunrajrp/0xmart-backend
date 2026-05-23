import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ChatRole } from '@prisma/client';

export interface ChatSessionData {
  id: string;
  userId?: string;
  guestId?: string;
  context?: any;
  messages: ChatMessageData[];
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

export interface ChatMessageData {
  id: string;
  role: ChatRole;
  content: string;
  metadata?: any;
  toolCalls?: any;
  createdAt: Date;
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create a new chat session
   */
  async createSession(
    userId?: string,
    guestId?: string,
    context?: any,
  ): Promise<ChatSessionData> {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry

    const session = await this.prisma.chatSession.create({
      data: {
        userId,
        guestId,
        context,
        expiresAt,
      },
      include: {
        messages: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    this.logger.debug(`Created chat session ${session.id} for ${userId || guestId}`);

    return this.mapSessionData(session);
  }

  /**
   * Get a chat session by ID (with optional ownership verification)
   */
  async getSession(sessionId: string, userId?: string): Promise<ChatSessionData | null> {
    const where: any = { id: sessionId };

    // If userId provided, verify ownership
    if (userId) {
      where.userId = userId;
    }

    const session = await this.prisma.chatSession.findFirst({
      where,
      include: {
        messages: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!session) {
      return null;
    }

    return this.mapSessionData(session);
  }

  /**
   * Add a message to a session
   */
  async addMessage(
    sessionId: string,
    role: ChatRole,
    content: string,
    metadata?: any,
    toolCalls?: any,
  ): Promise<ChatMessageData> {
    // Check if session is read-only
    const session = await this.prisma.chatSession.findUnique({
      where: { id: sessionId },
      select: { isReadOnly: true },
    });

    if (!session) {
      throw new BadRequestException('Session not found');
    }

    if (session.isReadOnly) {
      throw new BadRequestException(
        'This conversation is read-only and cannot be modified. Please start a new conversation.',
      );
    }

    const message = await this.prisma.chatMessage.create({
      data: {
        sessionId,
        role,
        content,
        metadata,
        toolCalls,
      },
    });

    return this.mapMessageData(message);
  }

  /**
   * Get session messages
   */
  async getMessages(
    sessionId: string,
    limit?: number,
  ): Promise<ChatMessageData[]> {
    const messages = await this.prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: {
        createdAt: 'asc',
      },
      ...(limit && { take: limit }),
    });

    return messages.map(msg => this.mapMessageData(msg));
  }

  /**
   * Update session context
   */
  async updateContext(
    sessionId: string,
    context: any,
  ): Promise<void> {
    await this.prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        context,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Delete old sessions (cleanup)
   */
  async deleteExpiredSessions(): Promise<number> {
    const result = await this.prisma.chatSession.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    this.logger.log(`Deleted ${result.count} expired chat sessions`);

    return result.count;
  }

  /**
   * Get user's recent sessions with advanced filtering
   */
  async getUserSessions(
    userId: string,
    options?: {
      includeReadOnly?: boolean;
      limit?: number;
    },
  ): Promise<any> {
    const includeReadOnly = options?.includeReadOnly !== false; // Default to true
    const limit = options?.limit || 50;

    const where: any = { userId };
    if (!includeReadOnly) {
      where.isReadOnly = false;
    }

    const sessions = await this.prisma.chatSession.findMany({
      where,
      orderBy: {
        updatedAt: 'desc',
      },
      take: limit,
      include: {
        messages: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1, // Get last message for preview
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
    });

    const formattedSessions = sessions.map(session => ({
      id: session.id,
      title: session.title || 'New Chat',
      isReadOnly: session.isReadOnly,
      lastMessage: session.messages[0]?.content || null,
      lastUpdated: session.updatedAt,
      messageCount: session._count.messages,
      hasOrder: !!session.relatedOrderId,
    }));

    return {
      sessions: formattedSessions,
      total: sessions.length,
    };
  }

  /**
   * Delete a user's session
   */
  async deleteSession(sessionId: string, userId: string): Promise<{ success: boolean }> {
    // Verify ownership
    const session = await this.prisma.chatSession.findFirst({
      where: {
        id: sessionId,
        userId,
      },
    });

    if (!session) {
      throw new Error('Session not found or access denied');
    }

    await this.prisma.chatSession.delete({
      where: { id: sessionId },
    });

    this.logger.debug(`User ${userId} deleted session ${sessionId}`);

    return { success: true };
  }

  /**
   * Update session title
   */
  async updateTitle(
    sessionId: string,
    title: string,
    userId: string,
  ): Promise<{ success: boolean; title: string }> {
    // Verify ownership
    const session = await this.prisma.chatSession.findFirst({
      where: {
        id: sessionId,
        userId,
      },
    });

    if (!session) {
      throw new Error('Session not found or access denied');
    }

    await this.prisma.chatSession.update({
      where: { id: sessionId },
      data: { title },
    });

    this.logger.debug(`User ${userId} updated title for session ${sessionId}: "${title}"`);

    return { success: true, title };
  }

  /**
   * Auto-generate session title from first user message
   */
  async generateSessionTitle(sessionId: string, firstMessage: string): Promise<void> {
    // Only generate if session doesn't already have a title
    const session = await this.prisma.chatSession.findUnique({
      where: { id: sessionId },
      select: { title: true },
    });

    if (session?.title) {
      return; // Already has a title
    }

    let title = firstMessage;
    if (title.length > 50) {
      title = title.substring(0, 47) + '...';
    }

    await this.prisma.chatSession.update({
      where: { id: sessionId },
      data: { title },
    });

    this.logger.debug(`Auto-generated title for session ${sessionId}: "${title}"`);
  }

  /**
   * Check if session should be marked read-only (10 days after order delivery)
   */
  async checkAndMarkReadOnly(sessionId: string): Promise<boolean> {
    const session = await this.prisma.chatSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        isReadOnly: true,
        relatedOrderId: true,
      },
    });

    if (!session || session.isReadOnly || !session.relatedOrderId) {
      return false; // Already read-only, or no order linked
    }

    // Check order delivery date
    const order = await this.prisma.order.findUnique({
      where: { id: session.relatedOrderId },
      select: {
        deliveredAt: true,
      },
    });

    if (!order?.deliveredAt) {
      return false; // Order not delivered yet
    }

    // Calculate 10 days after delivery
    const tenDaysAfterDelivery = new Date(order.deliveredAt);
    tenDaysAfterDelivery.setDate(tenDaysAfterDelivery.getDate() + 10);

    if (new Date() > tenDaysAfterDelivery) {
      // Mark as read-only
      await this.prisma.chatSession.update({
        where: { id: sessionId },
        data: { isReadOnly: true },
      });

      this.logger.log(`Marked session ${sessionId} as read-only (10 days after order delivery)`);
      return true;
    }

    return false;
  }

  /**
   * Link session to an order
   */
  async linkSessionToOrder(sessionId: string, orderId: string): Promise<void> {
    await this.prisma.chatSession.update({
      where: { id: sessionId },
      data: { relatedOrderId: orderId },
    });

    this.logger.debug(`Linked session ${sessionId} to order ${orderId}`);
  }

  private mapSessionData(session: any): ChatSessionData {
    return {
      id: session.id,
      userId: session.userId,
      guestId: session.guestId,
      context: session.context,
      messages: session.messages?.map(msg => this.mapMessageData(msg)) || [],
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      expiresAt: session.expiresAt,
    };
  }

  private mapMessageData(message: any): ChatMessageData {
    return {
      id: message.id,
      role: message.role,
      content: message.content,
      metadata: message.metadata,
      toolCalls: message.toolCalls,
      createdAt: message.createdAt,
    };
  }
}
