import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { WebhookEventType, WebhookStatus } from '@prisma/client';
import axios from 'axios';
import * as crypto from 'crypto';

interface WebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, any>;
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  // Retry delays in milliseconds (exponential backoff)
  private readonly retryDelays = [
    1 * 60 * 1000, // 1 minute
    5 * 60 * 1000, // 5 minutes
    30 * 60 * 1000, // 30 minutes
    2 * 60 * 60 * 1000, // 2 hours
    24 * 60 * 60 * 1000, // 24 hours
  ];

  constructor(private prisma: PrismaService) {}

  /**
   * Generate HMAC signature for webhook payload
   */
  private generateSignature(payload: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  /**
   * Send webhook notification to developer
   */
  async sendWebhook(
    orderId: string,
    eventType: WebhookEventType,
    data: Record<string, any>,
  ): Promise<void> {
    // Get order with API key webhook config
    const order = await this.prisma.externalOrder.findUnique({
      where: { id: orderId },
      include: {
        apiKey: {
          select: {
            webhookUrl: true,
            webhookSecret: true,
          },
        },
      },
    });

    if (!order?.apiKey?.webhookUrl) {
      this.logger.log(`No webhook URL configured for order ${orderId}`);
      return;
    }

    const payload: WebhookPayload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        ...data,
      },
    };

    // Create webhook log
    const webhookLog = await this.prisma.webhookLog.create({
      data: {
        orderId,
        eventType,
        webhookUrl: order.apiKey.webhookUrl,
        payload: payload as any,
        status: 'PENDING',
      },
    });

    // Send webhook asynchronously
    this.deliverWebhook(
      webhookLog.id,
      order.apiKey.webhookUrl,
      order.apiKey.webhookSecret,
      payload,
    );
  }

  /**
   * Deliver webhook with retry logic
   */
  private async deliverWebhook(
    webhookLogId: string,
    webhookUrl: string,
    webhookSecret: string | null,
    payload: WebhookPayload,
  ): Promise<void> {
    const payloadString = JSON.stringify(payload);
    const timestamp = Date.now().toString();

    // Generate signature
    const signature = webhookSecret
      ? this.generateSignature(`${timestamp}.${payloadString}`, webhookSecret)
      : null;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Timestamp': timestamp,
    };

    if (signature) {
      headers['X-Webhook-Signature'] = signature;
    }

    try {
      const response = await axios.post(webhookUrl, payload, {
        headers,
        timeout: 30000, // 30 second timeout
      });

      // Mark as delivered
      await this.prisma.webhookLog.update({
        where: { id: webhookLogId },
        data: {
          status: 'DELIVERED',
          statusCode: response.status,
          response: JSON.stringify(response.data).slice(0, 1000),
          deliveredAt: new Date(),
          lastAttemptAt: new Date(),
          attempts: { increment: 1 },
        },
      });

      this.logger.log(`Webhook delivered: ${webhookLogId}`);
    } catch (error: any) {
      const statusCode = error.response?.status || 0;
      const errorMessage = error.message || 'Unknown error';

      // Update webhook log
      const log = await this.prisma.webhookLog.findUnique({
        where: { id: webhookLogId },
      });

      if (!log) return;

      const attempts = log.attempts + 1;
      const shouldRetry = attempts < log.maxAttempts;

      await this.prisma.webhookLog.update({
        where: { id: webhookLogId },
        data: {
          status: shouldRetry ? 'RETRYING' : 'FAILED',
          statusCode,
          response: errorMessage.slice(0, 1000),
          lastAttemptAt: new Date(),
          attempts,
          nextRetryAt: shouldRetry
            ? new Date(
                Date.now() +
                  this.retryDelays[
                    Math.min(attempts - 1, this.retryDelays.length - 1)
                  ],
              )
            : null,
        },
      });

      this.logger.warn(
        `Webhook failed (attempt ${attempts}): ${webhookLogId} - ${errorMessage}`,
      );
    }
  }

  /**
   * Process pending webhook retries (called by scheduler)
   */
  async processRetries(): Promise<number> {
    const pendingRetries = await this.prisma.webhookLog.findMany({
      where: {
        status: 'RETRYING',
        nextRetryAt: { lte: new Date() },
      },
      take: 100,
    });

    for (const log of pendingRetries) {
      await this.deliverWebhook(
        log.id,
        log.webhookUrl,
        null, // We don't store secret in log, need to fetch from API key
        log.payload as unknown as WebhookPayload,
      );
    }

    return pendingRetries.length;
  }

  /**
   * Get webhook logs for an order
   */
  async getWebhookLogs(orderId: string) {
    return this.prisma.webhookLog.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        eventType: true,
        status: true,
        statusCode: true,
        attempts: true,
        createdAt: true,
        deliveredAt: true,
        lastAttemptAt: true,
      },
    });
  }

  /**
   * Helper methods for common webhook events
   */
  async notifyPaymentInitiated(
    orderId: string,
    orderDetails: Record<string, any>,
  ) {
    await this.sendWebhook(orderId, 'PAYMENT_INITIATED', {
      type: 'payment.initiated',
      ...orderDetails,
    });
  }

  async notifyPaymentDetected(orderId: string, txHash: string, amount: string) {
    await this.sendWebhook(orderId, 'PAYMENT_DETECTED', {
      type: 'payment.detected',
      txHash,
      amount,
    });
  }

  async notifyPaymentConfirmed(
    orderId: string,
    txHash: string,
    amount: string,
  ) {
    await this.sendWebhook(orderId, 'PAYMENT_CONFIRMED', {
      type: 'payment.confirmed',
      txHash,
      amount,
      message: 'Payment has been confirmed on blockchain',
    });
  }

  async notifyPaymentFailed(orderId: string, reason: string) {
    await this.sendWebhook(orderId, 'PAYMENT_FAILED', {
      type: 'payment.failed',
      reason,
    });
  }

  async notifyPaymentExpired(orderId: string) {
    await this.sendWebhook(orderId, 'PAYMENT_EXPIRED', {
      type: 'payment.expired',
      message: 'Payment window has expired',
    });
  }

  async notifyOrderShipped(
    orderId: string,
    trackingNumber: string,
    carrier?: string,
  ) {
    await this.sendWebhook(orderId, 'ORDER_SHIPPED', {
      type: 'order.shipped',
      trackingNumber,
      carrier,
    });
  }

  async notifyOrderDelivered(orderId: string) {
    await this.sendWebhook(orderId, 'ORDER_DELIVERED', {
      type: 'order.delivered',
      message: 'Order has been delivered',
    });
  }
}
