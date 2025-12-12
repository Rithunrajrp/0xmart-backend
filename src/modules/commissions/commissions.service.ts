import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CommissionStatus, NetworkType, StablecoinType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

// Commission becomes available after 14 days (return window)
const COMMISSION_AVAILABILITY_DAYS = 14;
const DEFAULT_COMMISSION_RATE = 0.05; // 5%
const MIN_PAYOUT_AMOUNT = 10; // Minimum $10 for payout

@Injectable()
export class CommissionsService {
  private readonly logger = new Logger(CommissionsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create commission record when order is placed
   */
  async createCommission(
    apiKeyId: string,
    externalOrderId: string,
    orderTotal: Decimal,
    stablecoinType: StablecoinType,
    network?: NetworkType,
  ) {
    // Get API key commission rate
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { id: apiKeyId },
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    const commissionRate =
      apiKey.commissionRate || new Decimal(DEFAULT_COMMISSION_RATE);
    const commissionAmount = orderTotal.mul(commissionRate);

    const commission = await this.prisma.commission.create({
      data: {
        apiKeyId,
        externalOrderId,
        orderTotal,
        commissionRate,
        commissionAmount,
        stablecoinType,
        network,
        status: 'PENDING',
      },
    });

    // Update pending earnings
    await this.prisma.apiKey.update({
      where: { id: apiKeyId },
      data: {
        pendingEarnings: { increment: commissionAmount },
      },
    });

    this.logger.log(
      `Commission created: ${commission.id} - ${commissionAmount} ${stablecoinType}`,
    );
    return commission;
  }

  /**
   * Confirm commission when payment is confirmed
   */
  async confirmCommission(externalOrderId: string) {
    const commission = await this.prisma.commission.findUnique({
      where: { externalOrderId },
    });

    if (!commission) {
      this.logger.warn(`No commission found for order ${externalOrderId}`);
      return null;
    }

    if (commission.status !== 'PENDING') {
      this.logger.warn(`Commission ${commission.id} already processed`);
      return commission;
    }

    // Calculate when commission becomes available
    const availableAt = new Date();
    availableAt.setDate(availableAt.getDate() + COMMISSION_AVAILABILITY_DAYS);

    const updated = await this.prisma.commission.update({
      where: { id: commission.id },
      data: {
        status: 'CONFIRMED',
        confirmedAt: new Date(),
        availableAt,
      },
    });

    this.logger.log(`Commission confirmed: ${commission.id}`);
    return updated;
  }

  /**
   * Make commission available for payout (called by scheduler after return window)
   */
  async processAvailableCommissions() {
    const confirmedCommissions = await this.prisma.commission.findMany({
      where: {
        status: 'CONFIRMED',
        availableAt: { lte: new Date() },
      },
    });

    for (const commission of confirmedCommissions) {
      await this.prisma.$transaction(async (tx) => {
        // Update commission status
        await tx.commission.update({
          where: { id: commission.id },
          data: { status: 'AVAILABLE' },
        });

        // Move from pending to available
        await tx.apiKey.update({
          where: { id: commission.apiKeyId },
          data: {
            pendingEarnings: { decrement: commission.commissionAmount },
            availableEarnings: { increment: commission.commissionAmount },
          },
        });
      });
    }

    this.logger.log(
      `Processed ${confirmedCommissions.length} commissions to available`,
    );
    return confirmedCommissions.length;
  }

  /**
   * Cancel commission (order cancelled/refunded)
   */
  async cancelCommission(externalOrderId: string, reason: string) {
    const commission = await this.prisma.commission.findUnique({
      where: { externalOrderId },
    });

    if (!commission) {
      return null;
    }

    if (commission.status === 'PAID' || commission.status === 'CANCELLED') {
      throw new BadRequestException('Cannot cancel this commission');
    }

    await this.prisma.$transaction(async (tx) => {
      // Update commission
      await tx.commission.update({
        where: { id: commission.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancellationReason: reason,
        },
      });

      // Update earnings based on previous status
      if (
        commission.status === 'PENDING' ||
        commission.status === 'CONFIRMED'
      ) {
        await tx.apiKey.update({
          where: { id: commission.apiKeyId },
          data: {
            pendingEarnings: { decrement: commission.commissionAmount },
          },
        });
      } else if (commission.status === 'AVAILABLE') {
        await tx.apiKey.update({
          where: { id: commission.apiKeyId },
          data: {
            availableEarnings: { decrement: commission.commissionAmount },
          },
        });
      }
    });

    this.logger.log(`Commission cancelled: ${commission.id}`);
    return commission;
  }

  /**
   * Get commission dashboard for API user
   */
  async getCommissionDashboard(apiKeyId: string) {
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { id: apiKeyId },
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    // Get commission stats
    const [pending, confirmed, available, paid, cancelled] = await Promise.all([
      this.prisma.commission.aggregate({
        where: { apiKeyId, status: 'PENDING' },
        _sum: { commissionAmount: true },
        _count: true,
      }),
      this.prisma.commission.aggregate({
        where: { apiKeyId, status: 'CONFIRMED' },
        _sum: { commissionAmount: true },
        _count: true,
      }),
      this.prisma.commission.aggregate({
        where: { apiKeyId, status: 'AVAILABLE' },
        _sum: { commissionAmount: true },
        _count: true,
      }),
      this.prisma.commission.aggregate({
        where: { apiKeyId, status: 'PAID' },
        _sum: { commissionAmount: true },
        _count: true,
      }),
      this.prisma.commission.aggregate({
        where: { apiKeyId, status: 'CANCELLED' },
        _sum: { commissionAmount: true },
        _count: true,
      }),
    ]);

    // Recent commissions
    const recentCommissions = await this.prisma.commission.findMany({
      where: { apiKeyId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        externalOrder: {
          select: {
            orderNumber: true,
            status: true,
            product: { select: { name: true } },
          },
        },
      },
    });

    return {
      summary: {
        commissionRate: `${Number(apiKey.commissionRate) * 100}%`,
        totalEarnings: apiKey.totalEarnings.toString(),
        pendingEarnings: apiKey.pendingEarnings.toString(),
        availableEarnings: apiKey.availableEarnings.toString(),
        payoutWallet: apiKey.payoutWalletAddress,
        payoutNetwork: apiKey.payoutNetwork,
      },
      breakdown: {
        pending: {
          count: pending._count,
          amount: pending._sum.commissionAmount?.toString() || '0',
        },
        confirmed: {
          count: confirmed._count,
          amount: confirmed._sum.commissionAmount?.toString() || '0',
        },
        available: {
          count: available._count,
          amount: available._sum.commissionAmount?.toString() || '0',
        },
        paid: {
          count: paid._count,
          amount: paid._sum.commissionAmount?.toString() || '0',
        },
        cancelled: {
          count: cancelled._count,
          amount: cancelled._sum.commissionAmount?.toString() || '0',
        },
      },
      recentCommissions: recentCommissions.map((c) => ({
        id: c.id,
        orderNumber: c.externalOrder.orderNumber,
        productName: c.externalOrder.product.name,
        orderTotal: c.orderTotal.toString(),
        commissionAmount: c.commissionAmount.toString(),
        status: c.status,
        createdAt: c.createdAt,
        availableAt: c.availableAt,
      })),
    };
  }

  /**
   * Get commission history
   */
  async getCommissionHistory(
    apiKeyId: string,
    options: {
      status?: CommissionStatus;
      page?: number;
      limit?: number;
    } = {},
  ) {
    const { status, page = 1, limit = 20 } = options;

    const where: any = { apiKeyId };
    if (status) {
      where.status = status;
    }

    const [commissions, total] = await Promise.all([
      this.prisma.commission.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          externalOrder: {
            select: {
              orderNumber: true,
              status: true,
              product: { select: { name: true, imageUrl: true } },
            },
          },
        },
      }),
      this.prisma.commission.count({ where }),
    ]);

    return {
      commissions: commissions.map((c) => ({
        id: c.id,
        orderNumber: c.externalOrder.orderNumber,
        orderStatus: c.externalOrder.status,
        product: {
          name: c.externalOrder.product.name,
          image: c.externalOrder.product.imageUrl,
        },
        orderTotal: c.orderTotal.toString(),
        commissionRate: `${Number(c.commissionRate) * 100}%`,
        commissionAmount: c.commissionAmount.toString(),
        currency: c.stablecoinType,
        status: c.status,
        createdAt: c.createdAt,
        confirmedAt: c.confirmedAt,
        availableAt: c.availableAt,
        paidAt: c.paidAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Request commission payout
   */
  async requestPayout(
    apiKeyId: string,
    walletAddress: string,
    network: NetworkType,
    stablecoinType: StablecoinType,
  ) {
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { id: apiKeyId },
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    const availableAmount = new Decimal(apiKey.availableEarnings.toString());
    if (availableAmount.lessThan(MIN_PAYOUT_AMOUNT)) {
      throw new BadRequestException(
        `Minimum payout amount is ${MIN_PAYOUT_AMOUNT}. Current available: ${availableAmount}`,
      );
    }

    // Get available commissions
    const availableCommissions = await this.prisma.commission.findMany({
      where: {
        apiKeyId,
        status: 'AVAILABLE',
        stablecoinType,
      },
    });

    if (availableCommissions.length === 0) {
      throw new BadRequestException(
        `No available commissions in ${stablecoinType}`,
      );
    }

    const totalAmount = availableCommissions.reduce(
      (sum, c) => sum.add(c.commissionAmount),
      new Decimal(0),
    );

    // Create payout request
    const payout = await this.prisma.commissionPayout.create({
      data: {
        apiKeyId,
        totalAmount,
        stablecoinType,
        network,
        walletAddress,
        status: 'PENDING',
      },
    });

    // Update commissions to reference payout
    await this.prisma.commission.updateMany({
      where: {
        id: { in: availableCommissions.map((c) => c.id) },
      },
      data: {
        payoutId: payout.id,
      },
    });

    // Update API key earnings
    await this.prisma.apiKey.update({
      where: { id: apiKeyId },
      data: {
        availableEarnings: { decrement: totalAmount },
        payoutWalletAddress: walletAddress,
        payoutNetwork: network,
      },
    });

    this.logger.log(
      `Payout requested: ${payout.id} - ${totalAmount} ${stablecoinType}`,
    );

    return {
      payoutId: payout.id,
      amount: totalAmount.toString(),
      currency: stablecoinType,
      network,
      walletAddress,
      status: 'PENDING',
      message:
        'Payout request submitted. Processing typically takes 1-3 business days.',
    };
  }

  /**
   * Get payout history
   */
  async getPayoutHistory(apiKeyId: string) {
    const payouts = await this.prisma.commissionPayout.findMany({
      where: { apiKeyId },
      orderBy: { createdAt: 'desc' },
      include: {
        commissions: {
          select: { id: true, commissionAmount: true },
        },
      },
    });

    return payouts.map((p) => ({
      id: p.id,
      amount: p.totalAmount.toString(),
      currency: p.stablecoinType,
      network: p.network,
      walletAddress: p.walletAddress,
      txHash: p.txHash,
      status: p.status,
      commissionsCount: p.commissions.length,
      requestedAt: p.requestedAt,
      processedAt: p.processedAt,
      completedAt: p.completedAt,
      failureReason: p.failureReason,
    }));
  }

  /**
   * Update payout wallet
   */
  async updatePayoutWallet(
    apiKeyId: string,
    walletAddress: string,
    network: NetworkType,
  ) {
    await this.prisma.apiKey.update({
      where: { id: apiKeyId },
      data: {
        payoutWalletAddress: walletAddress,
        payoutNetwork: network,
      },
    });

    return { message: 'Payout wallet updated successfully' };
  }
}
