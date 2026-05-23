import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreateSettlementRequestDto,
  SettlementFilterDto,
  ApproveSettlementDto,
  RejectSettlementDto,
  ConfirmSettlementDto,
  CancelSettlementDto,
  HoldSettlementDto,
  ReleaseHoldDto,
  BulkSettlementActionDto,
} from './dto';
import { NetworkType, StablecoinType, SettlementStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { MerchantWalletService } from '../merchant-wallet/merchant-wallet.service';

@Injectable()
export class SettlementService {
  // Platform fee percentage (5%)
  private readonly PLATFORM_FEE_RATE = 0.05;

  constructor(
    private readonly prisma: PrismaService,
    private readonly merchantWalletService: MerchantWalletService,
  ) {}

  /**
   * Generate unique settlement number
   */
  private generateSettlementNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `STL-${timestamp}-${random}`;
  }

  /**
   * Create a settlement request from a merchant
   */
  async createSettlementRequest(
    sellerId: string,
    dto: CreateSettlementRequestDto,
  ) {
    // Get merchant balance
    const balance = await this.prisma.merchantBalance.findUnique({
      where: {
        sellerId_stablecoinType: {
          sellerId,
          stablecoinType: dto.stablecoinType,
        },
      },
    });

    if (!balance) {
      throw new NotFoundException('No balance found for this stablecoin');
    }

    const availableBalance = balance.availableBalance.toNumber();
    const requestedAmount = dto.amount || availableBalance;

    if (requestedAmount <= 0) {
      throw new BadRequestException('No available balance to settle');
    }

    if (requestedAmount > availableBalance) {
      throw new BadRequestException(
        `Requested amount exceeds available balance. Available: ${availableBalance}`,
      );
    }

    // Minimum settlement amount check (e.g., $10)
    const minSettlement = 10;
    if (requestedAmount < minSettlement) {
      throw new BadRequestException(
        `Minimum settlement amount is ${minSettlement} ${dto.stablecoinType}`,
      );
    }

    // Get wallet address
    let wallet;
    if (dto.walletId) {
      wallet = await this.merchantWalletService.getWallet(sellerId, dto.walletId);
      if (wallet.network !== dto.network || wallet.stablecoinType !== dto.stablecoinType) {
        throw new BadRequestException(
          'Wallet does not match the selected network and stablecoin',
        );
      }
    } else {
      wallet = await this.merchantWalletService.getDefaultWallet(
        sellerId,
        dto.stablecoinType,
      );
    }

    if (!wallet) {
      throw new BadRequestException(
        `No wallet configured for ${dto.network} ${dto.stablecoinType}. Please add a wallet first.`,
      );
    }

    // Check for existing pending settlement
    const existingPending = await this.prisma.settlement.findFirst({
      where: {
        sellerId,
        stablecoinType: dto.stablecoinType,
        status: { in: ['PENDING', 'APPROVED', 'PROCESSING'] },
      },
    });

    if (existingPending) {
      throw new ConflictException(
        'You already have a pending settlement request for this stablecoin',
      );
    }

    // Calculate fees
    const grossAmount = requestedAmount;
    const platformFee = grossAmount * this.PLATFORM_FEE_RATE;
    const netAmount = grossAmount - platformFee;

    // Set period dates (settlement covers from last 30 days to now by default)
    const periodEnd = new Date();
    const periodStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default to 30 days ago

    // Create settlement request
    const settlement = await this.prisma.$transaction(async (tx) => {
      // Create the settlement
      const newSettlement = await tx.settlement.create({
        data: {
          settlementNumber: this.generateSettlementNumber(),
          sellerId,
          stablecoinType: dto.stablecoinType,
          network: dto.network,
          grossAmount: new Decimal(grossAmount),
          platformFee: new Decimal(platformFee),
          netAmount: new Decimal(netAmount),
          walletAddress: wallet.walletAddress,
          periodStart,
          periodEnd,
          status: 'PENDING',
        },
      });

      // Lock the amount in merchant balance (move from available to pending)
      await tx.merchantBalance.update({
        where: {
          sellerId_stablecoinType: {
            sellerId,
            stablecoinType: dto.stablecoinType,
          },
        },
        data: {
          availableBalance: { decrement: grossAmount },
          pendingBalance: { increment: grossAmount },
        },
      });

      return newSettlement;
    });

    return {
      ...settlement,
      grossAmount: settlement.grossAmount.toString(),
      platformFee: settlement.platformFee.toString(),
      netAmount: settlement.netAmount.toString(),
    };
  }

  /**
   * Get merchant's settlement history
   */
  async getMerchantSettlements(sellerId: string, dto: SettlementFilterDto) {
    const page = dto.page || 1;
    const limit = dto.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { sellerId };

    if (dto.stablecoinType) {
      where.stablecoinType = dto.stablecoinType;
    }
    if (dto.network) {
      where.network = dto.network;
    }
    if (dto.status) {
      where.status = dto.status;
    }
    if (dto.startDate) {
      where.createdAt = { ...where.createdAt, gte: new Date(dto.startDate) };
    }
    if (dto.endDate) {
      where.createdAt = { ...where.createdAt, lte: new Date(dto.endDate) };
    }

    const [settlements, total] = await Promise.all([
      this.prisma.settlement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.settlement.count({ where }),
    ]);

    return {
      settlements: settlements.map((s) => ({
        ...s,
        grossAmount: s.grossAmount.toString(),
        platformFee: s.platformFee.toString(),
        netAmount: s.netAmount.toString(),
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
   * Get single settlement by ID
   */
  async getSettlement(settlementId: string, sellerId?: string) {
    const where: any = { id: settlementId };
    if (sellerId) {
      where.sellerId = sellerId;
    }

    const settlement = await this.prisma.settlement.findFirst({
      where,
      include: {
        seller: {
          select: {
            id: true,
            companyName: true,
            user: {
              select: {
                email: true,
              },
            },
          },
        },
        items: true,
      },
    });

    if (!settlement) {
      throw new NotFoundException('Settlement not found');
    }

    return {
      ...settlement,
      grossAmount: settlement.grossAmount.toString(),
      platformFee: settlement.platformFee.toString(),
      netAmount: settlement.netAmount.toString(),
    };
  }

  /**
   * Cancel a pending settlement (merchant action)
   */
  async cancelSettlement(sellerId: string, settlementId: string, reason: string) {
    const settlement = await this.prisma.settlement.findFirst({
      where: { id: settlementId, sellerId },
    });

    if (!settlement) {
      throw new NotFoundException('Settlement not found');
    }

    if (settlement.status !== 'PENDING') {
      throw new BadRequestException(
        'Only pending settlements can be cancelled',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Update settlement status
      const updated = await tx.settlement.update({
        where: { id: settlementId },
        data: {
          status: 'CANCELLED',
          failureReason: reason,
        },
      });

      // Return funds to available balance
      await tx.merchantBalance.update({
        where: {
          sellerId_stablecoinType: {
            sellerId,
            stablecoinType: settlement.stablecoinType,
          },
        },
        data: {
          availableBalance: { increment: settlement.grossAmount },
          pendingBalance: { decrement: settlement.grossAmount },
        },
      });

      return {
        ...updated,
        grossAmount: updated.grossAmount.toString(),
        platformFee: updated.platformFee.toString(),
        netAmount: updated.netAmount.toString(),
      };
    });
  }

  // ===== ADMIN FUNCTIONS =====

  /**
   * Get all settlements (admin)
   */
  async getAllSettlements(dto: SettlementFilterDto) {
    const page = dto.page || 1;
    const limit = dto.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (dto.sellerId) {
      where.sellerId = dto.sellerId;
    }
    if (dto.stablecoinType) {
      where.stablecoinType = dto.stablecoinType;
    }
    if (dto.network) {
      where.network = dto.network;
    }
    if (dto.status) {
      where.status = dto.status;
    }
    if (dto.startDate) {
      where.createdAt = { ...where.createdAt, gte: new Date(dto.startDate) };
    }
    if (dto.endDate) {
      where.createdAt = { ...where.createdAt, lte: new Date(dto.endDate) };
    }

    const [settlements, total] = await Promise.all([
      this.prisma.settlement.findMany({
        where,
        include: {
          seller: {
            select: {
              id: true,
              companyName: true,
              user: {
                select: {
                  email: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.settlement.count({ where }),
    ]);

    return {
      settlements: settlements.map((s) => ({
        ...s,
        grossAmount: s.grossAmount.toString(),
        platformFee: s.platformFee.toString(),
        netAmount: s.netAmount.toString(),
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
   * Get settlement summary by status (admin dashboard)
   */
  async getSettlementSummary() {
    const [pending, approved, processing, completed, failed, onHold] =
      await Promise.all([
        this.prisma.settlement.aggregate({
          where: { status: 'PENDING' },
          _sum: { netAmount: true },
          _count: true,
        }),
        this.prisma.settlement.aggregate({
          where: { status: 'APPROVED' },
          _sum: { netAmount: true },
          _count: true,
        }),
        this.prisma.settlement.aggregate({
          where: { status: 'PROCESSING' },
          _sum: { netAmount: true },
          _count: true,
        }),
        this.prisma.settlement.aggregate({
          where: { status: 'COMPLETED' },
          _sum: { netAmount: true },
          _count: true,
        }),
        this.prisma.settlement.aggregate({
          where: { status: 'FAILED' },
          _sum: { netAmount: true },
          _count: true,
        }),
        this.prisma.settlement.aggregate({
          where: { status: 'ON_HOLD' },
          _sum: { netAmount: true },
          _count: true,
        }),
      ]);

    // Get total platform fees earned
    const platformFeesEarned = await this.prisma.settlement.aggregate({
      where: { status: 'COMPLETED' },
      _sum: { platformFee: true },
    });

    // Get this month's settlements
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const thisMonthCompleted = await this.prisma.settlement.aggregate({
      where: {
        status: 'COMPLETED',
        completedAt: { gte: startOfMonth },
      },
      _sum: { netAmount: true, platformFee: true },
      _count: true,
    });

    return {
      byStatus: {
        pending: {
          count: pending._count,
          amount: pending._sum.netAmount?.toString() || '0',
        },
        approved: {
          count: approved._count,
          amount: approved._sum.netAmount?.toString() || '0',
        },
        processing: {
          count: processing._count,
          amount: processing._sum.netAmount?.toString() || '0',
        },
        completed: {
          count: completed._count,
          amount: completed._sum.netAmount?.toString() || '0',
        },
        failed: {
          count: failed._count,
          amount: failed._sum.netAmount?.toString() || '0',
        },
        onHold: {
          count: onHold._count,
          amount: onHold._sum.netAmount?.toString() || '0',
        },
      },
      totalPlatformFeesEarned: platformFeesEarned._sum.platformFee?.toString() || '0',
      thisMonth: {
        completedCount: thisMonthCompleted._count,
        settledAmount: thisMonthCompleted._sum.netAmount?.toString() || '0',
        feesEarned: thisMonthCompleted._sum.platformFee?.toString() || '0',
      },
    };
  }

  /**
   * Approve a settlement (admin)
   */
  async approveSettlement(
    settlementId: string,
    adminId: string,
    dto: ApproveSettlementDto,
  ) {
    const settlement = await this.prisma.settlement.findUnique({
      where: { id: settlementId },
    });

    if (!settlement) {
      throw new NotFoundException('Settlement not found');
    }

    if (settlement.status !== 'PENDING' && settlement.status !== 'ON_HOLD') {
      throw new BadRequestException(
        `Settlement cannot be approved from ${settlement.status} status`,
      );
    }

    return this.prisma.settlement.update({
      where: { id: settlementId },
      data: {
        status: 'APPROVED',
        approvedBy: adminId,
        approvedAt: new Date(),
      },
    });
  }

  /**
   * Reject a settlement (admin)
   */
  async rejectSettlement(
    settlementId: string,
    adminId: string,
    dto: RejectSettlementDto,
  ) {
    const settlement = await this.prisma.settlement.findUnique({
      where: { id: settlementId },
    });

    if (!settlement) {
      throw new NotFoundException('Settlement not found');
    }

    if (!['PENDING', 'APPROVED', 'ON_HOLD'].includes(settlement.status)) {
      throw new BadRequestException(
        `Settlement cannot be rejected from ${settlement.status} status`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Update settlement
      const updated = await tx.settlement.update({
        where: { id: settlementId },
        data: {
          status: 'FAILED',
          failureReason: dto.reason,
        },
      });

      // Return funds to merchant available balance
      await tx.merchantBalance.update({
        where: {
          sellerId_stablecoinType: {
            sellerId: settlement.sellerId,
            stablecoinType: settlement.stablecoinType,
          },
        },
        data: {
          availableBalance: { increment: settlement.grossAmount },
          pendingBalance: { decrement: settlement.grossAmount },
        },
      });

      return {
        ...updated,
        grossAmount: updated.grossAmount.toString(),
        platformFee: updated.platformFee.toString(),
        netAmount: updated.netAmount.toString(),
      };
    });
  }

  /**
   * Put settlement on hold (admin)
   */
  async holdSettlement(
    settlementId: string,
    adminId: string,
    dto: HoldSettlementDto,
  ) {
    const settlement = await this.prisma.settlement.findUnique({
      where: { id: settlementId },
    });

    if (!settlement) {
      throw new NotFoundException('Settlement not found');
    }

    if (!['PENDING', 'APPROVED'].includes(settlement.status)) {
      throw new BadRequestException(
        `Settlement cannot be put on hold from ${settlement.status} status`,
      );
    }

    return this.prisma.settlement.update({
      where: { id: settlementId },
      data: {
        status: 'ON_HOLD',
      },
    });
  }

  /**
   * Release settlement from hold (admin)
   */
  async releaseHold(
    settlementId: string,
    adminId: string,
    dto: ReleaseHoldDto,
  ) {
    const settlement = await this.prisma.settlement.findUnique({
      where: { id: settlementId },
    });

    if (!settlement) {
      throw new NotFoundException('Settlement not found');
    }

    if (settlement.status !== 'ON_HOLD') {
      throw new BadRequestException('Settlement is not on hold');
    }

    return this.prisma.settlement.update({
      where: { id: settlementId },
      data: {
        status: 'PENDING',
      },
    });
  }

  /**
   * Mark settlement as processing (admin - before sending funds)
   */
  async markProcessing(settlementId: string, adminId: string) {
    const settlement = await this.prisma.settlement.findUnique({
      where: { id: settlementId },
    });

    if (!settlement) {
      throw new NotFoundException('Settlement not found');
    }

    if (settlement.status !== 'APPROVED') {
      throw new BadRequestException(
        'Only approved settlements can be processed',
      );
    }

    return this.prisma.settlement.update({
      where: { id: settlementId },
      data: {
        status: 'PROCESSING',
        processedAt: new Date(),
      },
    });
  }

  /**
   * Confirm settlement completion with transaction hash (admin)
   */
  async confirmSettlement(
    settlementId: string,
    adminId: string,
    dto: ConfirmSettlementDto,
  ) {
    const settlement = await this.prisma.settlement.findUnique({
      where: { id: settlementId },
    });

    if (!settlement) {
      throw new NotFoundException('Settlement not found');
    }

    if (settlement.status !== 'PROCESSING') {
      throw new BadRequestException(
        'Only processing settlements can be confirmed',
      );
    }

    // Check if txHash already exists
    const existingTx = await this.prisma.settlement.findUnique({
      where: { txHash: dto.txHash },
    });

    if (existingTx) {
      throw new ConflictException('Transaction hash already used');
    }

    return this.prisma.$transaction(async (tx) => {
      // Update settlement to completed
      const updated = await tx.settlement.update({
        where: { id: settlementId },
        data: {
          status: 'COMPLETED',
          txHash: dto.txHash,
          completedAt: new Date(),
        },
      });

      // Update merchant balance
      await tx.merchantBalance.update({
        where: {
          sellerId_stablecoinType: {
            sellerId: settlement.sellerId,
            stablecoinType: settlement.stablecoinType,
          },
        },
        data: {
          pendingBalance: { decrement: settlement.grossAmount },
          totalSettled: { increment: settlement.netAmount },
          totalCommission: { increment: settlement.platformFee },
        },
      });

      // Record platform revenue
      await tx.platformRevenue.create({
        data: {
          date: new Date(),
          referenceType: 'SETTLEMENT',
          referenceId: settlementId,
          revenueType: 'ORDER_COMMISSION',
          stablecoinType: settlement.stablecoinType,
          grossAmount: settlement.platformFee,
          revenueAmount: settlement.platformFee,
          description: `Settlement fee for ${settlement.settlementNumber}`,
        },
      });

      return {
        ...updated,
        grossAmount: updated.grossAmount.toString(),
        platformFee: updated.platformFee.toString(),
        netAmount: updated.netAmount.toString(),
      };
    });
  }

  /**
   * Mark settlement as failed (admin)
   */
  async markFailed(
    settlementId: string,
    adminId: string,
    reason: string,
    returnFunds: boolean = true,
  ) {
    const settlement = await this.prisma.settlement.findUnique({
      where: { id: settlementId },
    });

    if (!settlement) {
      throw new NotFoundException('Settlement not found');
    }

    if (!['APPROVED', 'PROCESSING'].includes(settlement.status)) {
      throw new BadRequestException(
        `Settlement cannot be marked failed from ${settlement.status} status`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.settlement.update({
        where: { id: settlementId },
        data: {
          status: 'FAILED',
          failureReason: reason,
        },
      });

      if (returnFunds) {
        // Return funds to merchant available balance
        await tx.merchantBalance.update({
          where: {
            sellerId_stablecoinType: {
              sellerId: settlement.sellerId,
              stablecoinType: settlement.stablecoinType,
            },
          },
          data: {
            availableBalance: { increment: settlement.grossAmount },
            pendingBalance: { decrement: settlement.grossAmount },
          },
        });
      }

      return {
        ...updated,
        grossAmount: updated.grossAmount.toString(),
        platformFee: updated.platformFee.toString(),
        netAmount: updated.netAmount.toString(),
      };
    });
  }

  /**
   * Bulk action on settlements (admin)
   */
  async bulkAction(adminId: string, dto: BulkSettlementActionDto) {
    const results = {
      success: [] as string[],
      failed: [] as { id: string; error: string }[],
    };

    for (const settlementId of dto.settlementIds) {
      try {
        switch (dto.action) {
          case 'APPROVE':
            await this.approveSettlement(settlementId, adminId, {
              notes: dto.reason,
            });
            break;
          case 'REJECT':
            await this.rejectSettlement(settlementId, adminId, {
              reason: dto.reason || 'Bulk rejection',
            });
            break;
          case 'HOLD':
            await this.holdSettlement(settlementId, adminId, {
              reason: dto.reason || 'Bulk hold',
            });
            break;
          case 'CANCEL':
            const settlement = await this.prisma.settlement.findUnique({
              where: { id: settlementId },
            });
            if (settlement) {
              await this.cancelSettlement(
                settlement.sellerId,
                settlementId,
                dto.reason || 'Bulk cancellation',
              );
            }
            break;
        }
        results.success.push(settlementId);
      } catch (error: any) {
        results.failed.push({
          id: settlementId,
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Get settlements awaiting processing by network
   */
  async getSettlementsForProcessing(network?: NetworkType) {
    const where: any = { status: 'APPROVED' };
    if (network) {
      where.network = network;
    }

    const settlements = await this.prisma.settlement.findMany({
      where,
      include: {
        seller: {
          select: {
            companyName: true,
            user: { select: { email: true } },
          },
        },
      },
      orderBy: { approvedAt: 'asc' },
    });

    // Group by network for batch processing
    const grouped: Record<string, any[]> = {};
    for (const s of settlements) {
      if (!grouped[s.network]) {
        grouped[s.network] = [];
      }
      grouped[s.network].push({
        ...s,
        grossAmount: s.grossAmount.toString(),
        platformFee: s.platformFee.toString(),
        netAmount: s.netAmount.toString(),
      });
    }

    return grouped;
  }

  /**
   * Get merchant settlement analytics
   */
  async getMerchantSettlementAnalytics(sellerId: string) {
    const [totalSettled, thisMonth, byNetwork] = await Promise.all([
      // Total all time
      this.prisma.settlement.aggregate({
        where: { sellerId, status: 'COMPLETED' },
        _sum: { netAmount: true, platformFee: true },
        _count: true,
      }),
      // This month
      this.prisma.settlement.aggregate({
        where: {
          sellerId,
          status: 'COMPLETED',
          completedAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
        _sum: { netAmount: true },
        _count: true,
      }),
      // By network
      this.prisma.settlement.groupBy({
        by: ['network'],
        where: { sellerId, status: 'COMPLETED' },
        _sum: { netAmount: true },
        _count: true,
      }),
    ]);

    return {
      allTime: {
        totalSettled: totalSettled._sum.netAmount?.toString() || '0',
        totalFees: totalSettled._sum.platformFee?.toString() || '0',
        count: totalSettled._count,
      },
      thisMonth: {
        totalSettled: thisMonth._sum.netAmount?.toString() || '0',
        count: thisMonth._count,
      },
      byNetwork: byNetwork.map((n) => ({
        network: n.network,
        totalSettled: n._sum.netAmount?.toString() || '0',
        count: n._count,
      })),
    };
  }
}
