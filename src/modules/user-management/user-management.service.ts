import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { UserType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class UserManagementService {
  private readonly logger = new Logger(UserManagementService.name);

  // User type upgrade thresholds
  private readonly USER_TYPE_THRESHOLDS = {
    WHALE: {
      minSpent: 10000, // $10,000
      minReferrals: 0,
    },
    MEMBER: {
      minSpent: 1000, // $1,000
      minReferrals: 5,
    },
    MOBILE: {
      minSpent: 100, // $100
      minReferrals: 0,
    },
  };

  constructor(private prisma: PrismaService) {}

  /**
   * Manually update user type by admin
   */
  async updateUserType(
    userId: string,
    userType: UserType,
    updatedBy: string,
    reason?: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const oldType = user.userType;

    await this.prisma.user.update({
      where: { id: userId },
      data: { userType },
    });

    // Log the change in audit log
    await this.prisma.auditLog.create({
      data: {
        userId: updatedBy,
        action: 'ADMIN_ACTION',
        entityType: 'user',
        entityId: userId,
        metadata: {
          action: 'UPDATE_USER_TYPE',
          oldType,
          newType: userType,
          reason: reason || 'Manual update by admin',
        },
      },
    });

    this.logger.log(
      `User ${userId} type updated from ${oldType} to ${userType} by ${updatedBy}`,
    );

    return {
      message: 'User type updated successfully',
      oldType,
      newType: userType,
    };
  }

  /**
   * Check and automatically upgrade user type based on activity
   */
  async checkAndUpgradeUserType(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        userType: true,
        totalSpent: true,
        totalReferrals: true,
        subscriptionTier: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const totalSpent = parseFloat(user.totalSpent.toString());
    let newType: UserType | null = null;

    // Check for WHALE upgrade (highest tier)
    if (
      user.userType !== UserType.WHALE &&
      totalSpent >= this.USER_TYPE_THRESHOLDS.WHALE.minSpent
    ) {
      newType = UserType.WHALE;
    }
    // Check for MEMBER upgrade
    else if (
      (user.userType === UserType.STANDARD &&
        totalSpent >= this.USER_TYPE_THRESHOLDS.MEMBER.minSpent) ||
      (user.userType === UserType.MOBILE &&
        (totalSpent >= this.USER_TYPE_THRESHOLDS.MEMBER.minSpent ||
          user.totalReferrals >= this.USER_TYPE_THRESHOLDS.MEMBER.minReferrals))
    ) {
      newType = UserType.MEMBER;
    }
    // Check for MOBILE upgrade
    else if (
      user.userType === UserType.STANDARD &&
      totalSpent >= this.USER_TYPE_THRESHOLDS.MOBILE.minSpent
    ) {
      newType = UserType.MOBILE;
    }

    // Perform upgrade if eligible
    if (newType) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { userType: newType },
      });

      // Create a milestone reward for the upgrade
      await this.prisma.reward.create({
        data: {
          userId: user.id,
          type: 'MILESTONE',
          status: 'EARNED',
          points: this.getUpgradeRewardPoints(newType),
          description: `Congratulations! You've been upgraded to ${newType} tier!`,
          referenceType: 'user_upgrade',
          referenceId: user.id,
        },
      });

      this.logger.log(`User ${userId} automatically upgraded to ${newType}`);

      return {
        upgraded: true,
        oldType: user.userType,
        newType,
        message: `Congratulations! You've been upgraded to ${newType}`,
      };
    }

    return {
      upgraded: false,
      currentType: user.userType,
      message: 'No upgrade available yet',
    };
  }

  /**
   * Get user statistics for upgrade
   */
  async getUserUpgradeStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        userType: true,
        totalSpent: true,
        totalReferrals: true,
        subscriptionTier: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const totalSpent = parseFloat(user.totalSpent.toString());
    const nextTier = this.getNextTier(user.userType);
    const requirements = nextTier
      ? this.USER_TYPE_THRESHOLDS[nextTier]
      : null;

    return {
      currentType: user.userType,
      totalSpent,
      totalReferrals: user.totalReferrals,
      subscriptionTier: user.subscriptionTier,
      nextTier,
      requirements,
      progress: requirements
        ? {
            spentProgress: (totalSpent / requirements.minSpent) * 100,
            referralProgress:
              (user.totalReferrals / requirements.minReferrals) * 100,
          }
        : null,
    };
  }

  /**
   * Update user spent amount (called after successful purchase)
   */
  async updateUserSpent(userId: string, amount: number) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        totalSpent: {
          increment: new Decimal(amount),
        },
      },
    });

    // Check for automatic upgrade
    await this.checkAndUpgradeUserType(userId);
  }

  /**
   * Update referral count (called when referred user makes first purchase)
   */
  async updateReferralCount(referrerId: string) {
    await this.prisma.user.update({
      where: { id: referrerId },
      data: {
        totalReferrals: {
          increment: 1,
        },
      },
    });

    // Check for automatic upgrade
    await this.checkAndUpgradeUserType(referrerId);
  }

  /**
   * Get next tier for a user type
   */
  private getNextTier(currentType: UserType): UserType | null {
    const tierOrder = [
      UserType.STANDARD,
      UserType.MOBILE,
      UserType.MEMBER,
      UserType.WHALE,
    ];
    const currentIndex = tierOrder.indexOf(currentType);
    if (currentIndex < tierOrder.length - 1) {
      return tierOrder[currentIndex + 1];
    }
    return null;
  }

  /**
   * Get reward points for tier upgrade
   */
  private getUpgradeRewardPoints(tier: UserType): number {
    const points = {
      MOBILE: 100,
      MEMBER: 500,
      WHALE: 2000,
      STANDARD: 0,
    };
    return points[tier] || 0;
  }

  /**
   * Get all users with filters
   */
  async getUsers(filters?: {
    userType?: UserType;
    page?: number;
    limit?: number;
  }) {
    const { userType, page = 1, limit = 20 } = filters || {};
    const skip = (page - 1) * limit;

    const where: any = {};
    if (userType) where.userType = userType;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          phoneNumber: true,
          countryCode: true,
          role: true,
          userType: true,
          status: true,
          kycStatus: true,
          totalSpent: true,
          totalReferrals: true,
          referralCode: true,
          createdAt: true,
          lastLoginAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
