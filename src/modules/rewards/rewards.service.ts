import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RewardType, StablecoinType, Reward } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class RewardsService {
  private readonly logger = new Logger(RewardsService.name);

  // Reward configurations
  private readonly REWARD_CONFIG = {
    PURCHASE: {
      pointsPerDollar: 10, // 10 points per $1 spent
      cashbackPercent: 0.5, // 0.5% cashback
    },
    REFERRAL: {
      referrerPoints: 500, // Points for referrer
      referreePoints: 250, // Points for referee
      referrerCashback: 10, // $10 for referrer
      refereeCashback: 5, // $5 for referee
    },
    FIRST_PURCHASE: {
      points: 1000,
      cashback: 5, // $5
    },
    SUBSCRIPTION: {
      basic: { points: 500, monthlyBonus: 50 },
      pro: { points: 2000, monthlyBonus: 200 },
      enterprise: { points: 5000, monthlyBonus: 500 },
    },
  };

  constructor(private prisma: PrismaService) {}

  /**
   * Create purchase reward
   */
  async createPurchaseReward(
    userId: string,
    orderId: string,
    amount: number,
    currency: StablecoinType,
  ) {
    // Check if this is first purchase
    const orderCount = await this.prisma.order.count({
      where: { userId },
    });

    const isFirstPurchase = orderCount === 1;

    // Calculate points and cashback
    const points = Math.floor(
      amount * this.REWARD_CONFIG.PURCHASE.pointsPerDollar,
    );
    const cashback = new Decimal(
      amount * (this.REWARD_CONFIG.PURCHASE.cashbackPercent / 100),
    );

    const rewards: Reward[] = [];

    // Regular purchase reward
    const purchaseReward = await this.prisma.reward.create({
      data: {
        userId,
        type: RewardType.PURCHASE,
        status: 'EARNED',
        points,
        amount: cashback,
        currency,
        description: `Reward for order #${orderId.substring(0, 8)}`,
        referenceType: 'order',
        referenceId: orderId,
      },
    });
    rewards.push(purchaseReward);

    // First purchase bonus
    if (isFirstPurchase) {
      const firstPurchaseReward = await this.prisma.reward.create({
        data: {
          userId,
          type: RewardType.FIRST_PURCHASE,
          status: 'EARNED',
          points: this.REWARD_CONFIG.FIRST_PURCHASE.points,
          amount: new Decimal(this.REWARD_CONFIG.FIRST_PURCHASE.cashback),
          currency,
          description: 'First purchase bonus! Welcome to 0xMart',
          referenceType: 'order',
          referenceId: orderId,
        },
      });
      rewards.push(firstPurchaseReward);

      this.logger.log(`First purchase reward created for user ${userId}`);
    }

    this.logger.log(
      `Purchase rewards created for user ${userId}, order ${orderId}`,
    );

    return rewards;
  }

  /**
   * Create referral rewards
   */
  async createReferralReward(
    referrerId: string,
    refereeId: string,
    orderId?: string,
  ) {
    const rewards: Reward[] = [];

    // Reward for referrer
    const referrerReward = await this.prisma.reward.create({
      data: {
        userId: referrerId,
        type: RewardType.REFERRAL,
        status: 'EARNED',
        points: this.REWARD_CONFIG.REFERRAL.referrerPoints,
        amount: new Decimal(this.REWARD_CONFIG.REFERRAL.referrerCashback),
        currency: StablecoinType.USDT,
        description: 'Referral bonus for inviting a friend!',
        referenceType: 'referral',
        referenceId: refereeId,
        metadata: { orderId },
      },
    });
    rewards.push(referrerReward);

    // Reward for referee
    const refereeReward = await this.prisma.reward.create({
      data: {
        userId: refereeId,
        type: RewardType.REFERRAL,
        status: 'EARNED',
        points: this.REWARD_CONFIG.REFERRAL.referreePoints,
        amount: new Decimal(this.REWARD_CONFIG.REFERRAL.refereeCashback),
        currency: StablecoinType.USDT,
        description: 'Welcome bonus for joining through referral!',
        referenceType: 'referral',
        referenceId: referrerId,
        metadata: { orderId },
      },
    });
    rewards.push(refereeReward);

    this.logger.log(
      `Referral rewards created for referrer ${referrerId} and referee ${refereeId}`,
    );

    return rewards;
  }

  /**
   * Create subscription reward
   */
  async createSubscriptionReward(
    userId: string,
    tier: 'basic' | 'pro' | 'enterprise',
    subscriptionId: string,
  ) {
    const config = this.REWARD_CONFIG.SUBSCRIPTION[tier];

    const reward = await this.prisma.reward.create({
      data: {
        userId,
        type: RewardType.SUBSCRIPTION,
        status: 'EARNED',
        points: config.points,
        description: `${tier.toUpperCase()} subscription activated! Enjoy ${config.monthlyBonus} points monthly`,
        referenceType: 'subscription',
        referenceId: subscriptionId,
        metadata: { tier, monthlyBonus: config.monthlyBonus },
      },
    });

    this.logger.log(
      `Subscription reward created for user ${userId}, tier ${tier}`,
    );

    return reward;
  }

  /**
   * Get user rewards
   */
  async getUserRewards(userId: string, status?: string) {
    const where: any = { userId };
    if (status) where.status = status;

    const rewards = await this.prisma.reward.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Calculate totals
    const totals = await this.prisma.reward.aggregate({
      where: { userId, status: 'EARNED' },
      _sum: {
        points: true,
      },
    });

    return {
      rewards,
      totalPoints: totals._sum.points || 0,
    };
  }

  /**
   * Claim a reward
   */
  async claimReward(rewardId: string, userId: string) {
    const reward = await this.prisma.reward.findFirst({
      where: { id: rewardId, userId },
    });

    if (!reward) {
      throw new Error('Reward not found');
    }

    if (reward.status !== 'EARNED') {
      throw new Error('Reward is not available for claiming');
    }

    const updatedReward = await this.prisma.reward.update({
      where: { id: rewardId },
      data: {
        status: 'CLAIMED',
        claimedAt: new Date(),
      },
    });

    this.logger.log(`Reward ${rewardId} claimed by user ${userId}`);

    return updatedReward;
  }

  /**
   * Get reward statistics
   */
  async getRewardStatistics(userId: string) {
    const [totalRewards, earnedRewards, claimedRewards, totalPoints] =
      await Promise.all([
        this.prisma.reward.count({ where: { userId } }),
        this.prisma.reward.count({ where: { userId, status: 'EARNED' } }),
        this.prisma.reward.count({ where: { userId, status: 'CLAIMED' } }),
        this.prisma.reward.aggregate({
          where: { userId, status: { in: ['EARNED', 'CLAIMED'] } },
          _sum: { points: true },
        }),
      ]);

    return {
      totalRewards,
      earnedRewards,
      claimedRewards,
      totalPoints: totalPoints._sum.points || 0,
    };
  }

  /**
   * Admin: Get all rewards with filters and pagination
   */
  async getAllRewards(filters?: {
    userId?: string;
    status?: string;
    type?: string;
    page?: number;
    limit?: number;
  }) {
    const { userId, status, type, page = 1, limit = 20 } = filters || {};
    const skip = (page - 1) * limit;

    const where: any = {};
    if (userId) where.userId = userId;
    if (status) where.status = status;
    if (type) where.type = type;

    const [rewards, total] = await Promise.all([
      this.prisma.reward.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              phoneNumber: true,
            },
          },
        },
      }),
      this.prisma.reward.count({ where }),
    ]);

    return {
      rewards,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Admin: Get reward by ID
   */
  async getRewardById(rewardId: string) {
    return this.prisma.reward.findUnique({
      where: { id: rewardId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phoneNumber: true,
            userType: true,
          },
        },
      },
    });
  }

  /**
   * Admin: Update reward status
   */
  async updateRewardStatus(rewardId: string, status: string) {
    const reward = await this.prisma.reward.update({
      where: { id: rewardId },
      data: { status: status as any },
    });

    this.logger.log(`Reward ${rewardId} status updated to ${status}`);
    return reward;
  }

  /**
   * Admin: Get system-wide reward statistics
   */
  async getAdminStatistics() {
    const [
      totalRewards,
      earnedRewards,
      claimedRewards,
      totalPoints,
      totalAmount,
      rewardsByType,
    ] = await Promise.all([
      this.prisma.reward.count(),
      this.prisma.reward.count({ where: { status: 'EARNED' } }),
      this.prisma.reward.count({ where: { status: 'CLAIMED' } }),
      this.prisma.reward.aggregate({ _sum: { points: true } }),
      this.prisma.reward.aggregate({
        where: { amount: { not: null } },
        _sum: { amount: true },
      }),
      this.prisma.reward.groupBy({
        by: ['type'],
        _count: { type: true },
        _sum: { points: true },
      }),
    ]);

    return {
      totalRewards,
      earnedRewards,
      claimedRewards,
      totalPoints: totalPoints._sum.points || 0,
      totalAmount: totalAmount._sum.amount || 0,
      rewardsByType,
    };
  }
}
