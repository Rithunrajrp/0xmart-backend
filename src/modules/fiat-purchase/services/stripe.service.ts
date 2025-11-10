import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private stripe: Stripe;

  constructor(private configService: ConfigService) {
    const secretKey = this.configService.get<string>('stripe.secretKey');

    if (!secretKey) {
      this.logger.warn('⚠️ Stripe not configured');
      return;
    }

    this.stripe = new Stripe(secretKey, {
      apiVersion: '2025-10-29.clover',
    });

    this.logger.log('✅ Stripe initialized');
  }

  async createPaymentIntent(
    amount: number,
    currency: string,
    metadata: Record<string, string>,
  ) {
    if (!this.stripe) {
      throw new BadRequestException('Stripe not configured');
    }

    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Stripe uses cents
        currency: currency.toLowerCase(),
        automatic_payment_methods: {
          enabled: true,
        },
        metadata,
      });

      this.logger.log(`Payment intent created: ${paymentIntent.id}`);

      return {
        id: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
      };
    } catch (error) {
      this.logger.error(`Stripe payment intent error: ${error.message}`);
      throw new BadRequestException('Failed to create payment');
    }
  }

  async retrievePaymentIntent(paymentIntentId: string) {
    if (!this.stripe) {
      throw new BadRequestException('Stripe not configured');
    }

    return this.stripe.paymentIntents.retrieve(paymentIntentId);
  }

  async createCheckoutSession(
    amount: number,
    currency: string,
    metadata: Record<string, string>,
    successUrl: string,
    cancelUrl: string,
  ) {
    if (!this.stripe) {
      throw new BadRequestException('Stripe not configured');
    }

    try {
      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: currency.toLowerCase(),
              product_data: {
                name: `${metadata.stablecoinType} Purchase`,
                description: `Purchase ${metadata.stablecoinAmount} ${metadata.stablecoinType}`,
              },
              unit_amount: Math.round(amount * 100),
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata,
      });

      this.logger.log(`Checkout session created: ${session.id}`);

      return {
        id: session.id,
        url: session.url,
        amount: amount,
        currency: currency,
      };
    } catch (error) {
      this.logger.error(`Stripe checkout error: ${error.message}`);
      throw new BadRequestException('Failed to create checkout session');
    }
  }

  handleWebhook(signature: string, payload: Buffer) {
    if (!this.stripe) {
      throw new BadRequestException('Stripe not configured');
    }

    const webhookSecret = this.configService.get<string>(
      'stripe.webhookSecret',
    );

    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret as string,
      );

      return event;
    } catch (error) {
      this.logger.error(
        `Webhook signature verification failed: ${error.message}`,
      );
      throw new BadRequestException('Invalid signature');
    }
  }

  async refund(paymentIntentId: string, amount?: number) {
    if (!this.stripe) {
      throw new BadRequestException('Stripe not configured');
    }

    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: paymentIntentId,
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
    return !!this.stripe;
  }
}
