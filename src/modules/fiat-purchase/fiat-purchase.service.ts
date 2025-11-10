import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';
import { ExchangeRateService } from './services/exchange-rate.service';
import { StripeService } from './services/stripe.service';
import { RazorpayService } from './services/razorpay.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import {
  FiatPaymentStatus,
  KYCStatus,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class FiatPurchaseService {
  private readonly logger = new Logger(FiatPurchaseService.name);

  constructor(
    private prisma: PrismaService,
    private walletsService: WalletsService,
    private exchangeRateService: ExchangeRateService,
    private stripeService: StripeService,
    private razorpayService: RazorpayService,
  ) {}

  async createPurchase(userId: string, createPurchaseDto: CreatePurchaseDto) {
    const {
      provider,
      stablecoinType,
      fiatAmount,
      fiatCurrency = 'USD',
      paymentMethod,
    } = createPurchaseDto;

    // Check KYC status
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.kycStatus !== KYCStatus.APPROVED) {
      throw new BadRequestException(
        'KYC verification required for fiat purchases. Please complete KYC first.',
      );
    }

    // Check if provider is configured
    if (provider === 'STRIPE' && !this.stripeService.isConfigured()) {
      throw new BadRequestException('Stripe payment not available');
    }

    if (provider === 'RAZORPAY' && !this.razorpayService.isConfigured()) {
      throw new BadRequestException('Razorpay payment not available');
    }

    // Get exchange rate
    const exchangeRate = await this.exchangeRateService.getExchangeRate(
      stablecoinType,
      fiatCurrency,
    );

    // Calculate fees
    const processingFee = this.exchangeRateService.calculateProcessingFee(
      fiatAmount,
      provider,
    );

    // Calculate stablecoin amount
    const stablecoinAmount = this.exchangeRateService.calculateStablecoinAmount(
      fiatAmount,
      exchangeRate,
      processingFee,
    );

    // Create payment with provider
    let providerResponse: any;
    let clientSecret: string = ''; // Initialize clientSecret
    let paymentUrl: string = '';

    if (provider === 'STRIPE') {
      providerResponse = await this.stripeService.createPaymentIntent(
        fiatAmount,
        fiatCurrency,
        {
          userId,
          stablecoinType,
          stablecoinAmount: stablecoinAmount.toString(),
        },
      );

      clientSecret = providerResponse.clientSecret;

      paymentUrl = `https://checkout.stripe.com/${providerResponse.id}`;
    } else if (provider === 'RAZORPAY') {
      providerResponse = await this.razorpayService.createOrder(
        fiatAmount,
        fiatCurrency,
        {
          userId,
          stablecoinType,
          stablecoinAmount: stablecoinAmount.toString(),
        },
      );

      clientSecret = providerResponse.id;

      paymentUrl = `razorpay://checkout/${providerResponse.id}`;
    }

    // Create fiat purchase record
    const purchase = await this.prisma.fiatPurchase.create({
      data: {
        userId,
        provider,

        providerTxId: providerResponse.id,
        stablecoinType,
        fiatAmount: new Decimal(fiatAmount),
        fiatCurrency,
        stablecoinAmount,
        exchangeRate,
        processingFee,
        status: FiatPaymentStatus.INITIATED,
        paymentMethod,
      },
    });

    // Create transaction record
    await this.prisma.transaction.create({
      data: {
        userId,
        type: TransactionType.FIAT_PURCHASE,
        status: TransactionStatus.PENDING,
        stablecoinType,
        amount: stablecoinAmount,
        fee: processingFee,
        metadata: {
          fiatAmount,
          fiatCurrency,
          exchangeRate: exchangeRate.toString(),
          provider,

          providerTxId: providerResponse.id,
        },
      },
    });

    this.logger.log(
      `Fiat purchase initiated: ${purchase.id} for user ${userId}`,
    );

    return {
      purchaseId: purchase.id,
      clientSecret,
      paymentUrl,
      amount: fiatAmount,
      currency: fiatCurrency,
      stablecoinAmount: stablecoinAmount.toString(),
      provider,
    };
  }

  async handleStripeWebhook(event: any) {
    this.logger.log(`Stripe webhook received: ${event.type}`);

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      await this.completePurchase(paymentIntent.id, 'STRIPE');
    } else if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      await this.failPurchase(paymentIntent.id, 'STRIPE', 'Payment failed');
    }

    return { received: true };
  }

  async handleRazorpayWebhook(event: string, payload: any) {
    this.logger.log(`Razorpay webhook received: ${event}`);

    if (event === 'payment.captured') {
      const payment = payload.payment.entity;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      await this.completePurchase(payment.order_id, 'RAZORPAY');
    } else if (event === 'payment.failed') {
      const payment = payload.payment.entity;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      await this.failPurchase(payment.order_id, 'RAZORPAY', 'Payment failed');
    }

    return { received: true };
  }

  private async completePurchase(providerTxId: string, provider: string) {
    console.log('Completing purchase for ', providerTxId, provider);
    const purchase = await this.prisma.fiatPurchase.findUnique({
      where: { providerTxId },
    });

    if (!purchase) {
      this.logger.warn(`Purchase not found for provider TX: ${providerTxId}`);
      return;
    }

    if (purchase.status === FiatPaymentStatus.COMPLETED) {
      this.logger.warn(`Purchase already completed: ${purchase.id}`);
      return;
    }

    // Find or create wallet
    let wallet = await this.prisma.wallet.findUnique({
      where: {
        userId_stablecoinType_network: {
          userId: purchase.userId,
          stablecoinType: purchase.stablecoinType,
          network: 'POLYGON', // Default network
        },
      },
    });

    if (!wallet) {
      wallet = await this.walletsService.createWallet(purchase.userId, {
        stablecoinType: purchase.stablecoinType,
        network: 'POLYGON',
      });
    }

    // Credit wallet
    await this.walletsService.updateBalance(
      wallet.id,
      new Decimal(purchase.stablecoinAmount.toString()),
      'add',
    );

    // Update purchase status
    await this.prisma.fiatPurchase.update({
      where: { id: purchase.id },
      data: {
        status: FiatPaymentStatus.COMPLETED,
        completedAt: new Date(),
      },
    });

    // Update transaction
    await this.prisma.transaction.updateMany({
      where: {
        userId: purchase.userId,
        metadata: {
          path: ['providerTxId'],
          equals: providerTxId,
        },
      },
      data: {
        status: TransactionStatus.COMPLETED,
      },
    });

    this.logger.log(
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      `Purchase completed: ${purchase.id}, credited ${purchase.stablecoinAmount} ${purchase.stablecoinType}`,
    );
  }

  private async failPurchase(
    providerTxId: string,
    provider: string,
    reason: string,
  ) {
    const purchase = await this.prisma.fiatPurchase.findUnique({
      where: { providerTxId },
    });

    if (!purchase) {
      this.logger.warn(
        `Purchase not found for provider TX: ${providerTxId} Provider: ${provider}`,
      );
      return;
    }

    await this.prisma.fiatPurchase.update({
      where: { id: purchase.id },
      data: {
        status: FiatPaymentStatus.FAILED,
        failureReason: reason,
      },
    });

    await this.prisma.transaction.updateMany({
      where: {
        userId: purchase.userId,
        metadata: {
          path: ['providerTxId'],
          equals: providerTxId,
        },
      },
      data: {
        status: TransactionStatus.FAILED,
        failureReason: reason,
      },
    });

    this.logger.log(`Purchase failed: ${purchase.id}`);
  }

  async getPurchaseHistory(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [purchases, total] = await Promise.all([
      this.prisma.fiatPurchase.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.fiatPurchase.count({ where: { userId } }),
    ]);

    return {
      purchases,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getPurchaseById(purchaseId: string, userId: string) {
    const purchase = await this.prisma.fiatPurchase.findFirst({
      where: { id: purchaseId, userId },
    });

    if (!purchase) {
      throw new NotFoundException('Purchase not found');
    }

    return purchase;
  }

  // Admin functions
  async getAllPurchases(filters?: {
    status?: FiatPaymentStatus;
    provider?: string;
    page?: number;
    limit?: number;
  }) {
    const { status, provider, page = 1, limit = 20 } = filters || {};
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (provider) where.provider = provider;

    const [purchases, total] = await Promise.all([
      this.prisma.fiatPurchase.findMany({
        where,
        skip,
        take: limit,
        // select: {
        //   user: {
        //     select: {
        //       id: true,
        //       email: true,
        //     },
        //   },
        // },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.fiatPurchase.count({ where }),
    ]);

    return {
      purchases,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async refundPurchase(purchaseId: string, adminId: string) {
    const purchase = await this.prisma.fiatPurchase.findUnique({
      where: { id: purchaseId },
    });

    if (!purchase) {
      throw new NotFoundException('Purchase not found');
    }

    if (purchase.status !== FiatPaymentStatus.COMPLETED) {
      throw new BadRequestException('Can only refund completed purchases');
    }

    // Process refund with provider
    if (purchase.provider === 'STRIPE') {
      await this.stripeService.refund(purchase.providerTxId);
    } else if (purchase.provider === 'RAZORPAY') {
      // Get payment ID from order

      const payment = await this.razorpayService.fetchOrder(
        purchase.providerTxId,
      );
      // Note: You'll need to store payment ID separately for Razorpay refunds
      // await this.razorpayService.refund(paymentId);

      console.warn(`Razorpay refund not implemented yet ${payment.id}`);
    }

    // Deduct from wallet
    const wallet = await this.prisma.wallet.findUnique({
      where: {
        userId_stablecoinType_network: {
          userId: purchase.userId,
          stablecoinType: purchase.stablecoinType,
          network: 'POLYGON',
        },
      },
    });

    if (wallet) {
      await this.walletsService.updateBalance(
        wallet.id,
        new Decimal(purchase.stablecoinAmount.toString()),
        'subtract',
      );
    }

    // Update purchase
    await this.prisma.fiatPurchase.update({
      where: { id: purchaseId },
      data: { status: FiatPaymentStatus.REFUNDED },
    });

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        userId: purchase.userId,
        action: 'ADMIN_ACTION',
        entityType: 'fiat_purchase',
        entityId: purchaseId,
        metadata: {
          action: 'refund',
          adminId,
          amount: purchase.fiatAmount.toString(),
        },
      },
    });

    this.logger.log(`Purchase refunded: ${purchaseId} by admin ${adminId}`);

    return { success: true, message: 'Purchase refunded successfully' };
  }
}
