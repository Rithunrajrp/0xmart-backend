import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SessionService } from './session.service';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Scheduled service to mark chat sessions as read-only
 * after 10 days from order delivery
 */
@Injectable()
export class SessionExpiryService {
  private readonly logger = new Logger(SessionExpiryService.name);

  constructor(
    private sessionService: SessionService,
    private prisma: PrismaService,
  ) {}

  /**
   * Runs daily at midnight to check and mark expired sessions
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async markExpiredSessionsReadOnly() {
    this.logger.log('Running session expiry check...');

    try {
      // Find all active sessions linked to orders
      const sessions = await this.prisma.chatSession.findMany({
        where: {
          isReadOnly: false,
          relatedOrderId: { not: null },
        },
        select: {
          id: true,
          relatedOrderId: true,
        },
      });

      this.logger.log(`Found ${sessions.length} active sessions with orders`);

      let markedCount = 0;

      // Check each session for expiry
      for (const session of sessions) {
        const wasMarked = await this.sessionService.checkAndMarkReadOnly(session.id);
        if (wasMarked) {
          markedCount++;
        }
      }

      this.logger.log(`Marked ${markedCount} sessions as read-only`);
    } catch (error) {
      this.logger.error('Error marking expired sessions:', error);
    }
  }

  /**
   * Manually trigger expiry check (for testing or admin operations)
   */
  async triggerExpiryCheck(): Promise<{ sessionsChecked: number; sessionsMarked: number }> {
    const sessions = await this.prisma.chatSession.findMany({
      where: {
        isReadOnly: false,
        relatedOrderId: { not: null },
      },
      select: {
        id: true,
      },
    });

    let markedCount = 0;

    for (const session of sessions) {
      const wasMarked = await this.sessionService.checkAndMarkReadOnly(session.id);
      if (wasMarked) {
        markedCount++;
      }
    }

    return {
      sessionsChecked: sessions.length,
      sessionsMarked: markedCount,
    };
  }
}
