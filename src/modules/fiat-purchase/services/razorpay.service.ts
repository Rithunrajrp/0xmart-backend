import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Razorpay from 'razorpay';
import * as crypto from 'crypto';

@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);
  private razorpay: any;

  constructor(private configService: ConfigService) {
    const keyId = this.configService.get<string>('razorpay.keyId');
    const keySecret = this.configService.get<string>('razorpay.keySecret');

    if (!keyId || !keySecret) {
      this.logger.warn('⚠️ Razorpay not configured');
      return;
    }

    this.razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    this.logger.log('✅ Razorpay initialized');
  }

  async createOrder(
    amount: number,
    currency: string,
    metadata: Record<string, string>,
  ) {
    if (!this.razorpay) {
      throw new BadRequestException('Razorpay not configured');
    }

    try {
      const order = await this.razorpay.orders.create({
        amount: Math.round(amount * 100), // Razorpay uses paise
        currency: currency.toUpperCase(),
        notes: metadata,
      });

      this.logger.log(`Razorpay order created: ${order.id}`);

      return {
        id: order.id,
        amount: order.amount / 100,
        currency: order.currency,
        status: order.status,
      };
    } catch (error) {
      this.logger.error(`Razorpay order error: ${error.message}`);
      throw new BadRequestException('Failed to create order');
    }
  }

  fetchOrder(orderId: string) {
    if (!this.razorpay) {
      throw new BadRequestException('Razorpay not configured');
    }

    return this.razorpay.orders.fetch(orderId);
  }

  fetchPayment(paymentId: string) {
    if (!this.razorpay) {
      throw new BadRequestException('Razorpay not configured');
    }

    return this.razorpay.payments.fetch(paymentId);
  }

  verifyWebhookSignature(signature: string, payload: string): boolean {
    if (!this.razorpay) {
      throw new BadRequestException('Razorpay not configured');
    }

    const webhookSecret = this.configService.get<string>(
      'razorpay.webhookSecret',
    );

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret as string)
      .update(payload)
      .digest('hex');

    return expectedSignature === signature;
  }

  verifyPaymentSignature(
    orderId: string,
    paymentId: string,
    signature: string,
  ): boolean {
    if (!this.razorpay) {
      throw new BadRequestException('Razorpay not configured');
    }

    const keySecret = this.configService.get<string>('razorpay.keySecret');
    const message = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', keySecret as string)
      .update(message)
      .digest('hex');

    return expectedSignature === signature;
  }

  async refund(paymentId: string, amount?: number) {
    if (!this.razorpay) {
      throw new BadRequestException('Razorpay not configured');
    }

    try {
      const refund = await this.razorpay.payments.refund(paymentId, {
        amount: amount ? Math.round(amount * 100) : undefined,
      });

      this.logger.log(`Refund created: ${refund.id}`);
      return refund;
    } catch (error) {
      this.logger.error(`Refund error: ${error.message}`);
      throw new BadRequestException('Failed to process refund');
    }
  }

  isConfigured(): boolean {
    return !!this.razorpay;
  }
}
