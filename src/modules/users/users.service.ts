import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserStatus, KYCStatus } from '@prisma/client';
import { OtpService } from '../auth/services/otp.service';
import { EmailService } from '../auth/services/email.service';
import { TwilioService } from '../auth/services/twilio.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  // Store pending updates temporarily (in production, use Redis)
  private pendingUpdates = new Map<
    string,
    {
      type: 'email' | 'phone';
      newValue: string;
      verifiedCurrent: boolean;
      expiresAt: Date;
    }
  >();

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => OtpService))
    private otpService: OtpService,
    @Inject(forwardRef(() => EmailService))
    private emailService: EmailService,
    @Inject(forwardRef(() => TwilioService))
    private twilioService: TwilioService,
  ) {}

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        wallets: {
          select: {
            id: true,
            stablecoinType: true,
            network: true,
            depositAddress: true,
            balance: true,
            lockedBalance: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  async findByPhoneNumber(phoneNumber: string) {
    return this.prisma.user.findUnique({
      where: { phoneNumber },
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if email is already taken
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await this.findByEmail(updateUserDto.email);
      if (existingUser) {
        throw new BadRequestException('Email already in use');
      }
    }

    // Check if phone number is already taken
    if (updateUserDto.phoneNumber && updateUserDto.countryCode) {
      const fullPhone = `${updateUserDto.countryCode}${updateUserDto.phoneNumber}`;
      if (fullPhone !== user.phoneNumber) {
        const existingUser = await this.findByPhoneNumber(fullPhone);
        if (existingUser) {
          throw new BadRequestException('Phone number already in use');
        }
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        ...updateUserDto,
        email: updateUserDto.email?.toLowerCase(),
        phoneNumber:
          updateUserDto.phoneNumber && updateUserDto.countryCode
            ? `${updateUserDto.countryCode}${updateUserDto.phoneNumber}`
            : undefined,
      },
      include: {
        wallets: true,
      },
    });

    this.logger.log(`User ${id} updated`);
    return updatedUser;
  }

  async getUserStats(userId: string) {
    const [user, transactionCount, orderCount] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          wallets: {
            select: {
              stablecoinType: true,
              balance: true,
              lockedBalance: true,
            },
          },
        },
      }),
      this.prisma.transaction.count({ where: { userId } }),
      this.prisma.order.count({ where: { userId } }),
    ]);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Calculate total balance across all wallets in USD equivalent
    const totalBalance = user.wallets.reduce((sum, wallet) => {
      return sum + Number(wallet.balance);
    }, 0);

    const totalLocked = user.wallets.reduce((sum, wallet) => {
      return sum + Number(wallet.lockedBalance);
    }, 0);

    return {
      userId: user.id,
      kycStatus: user.kycStatus,
      totalBalance: totalBalance.toFixed(2),
      totalLocked: totalLocked.toFixed(2),
      walletsCount: user.wallets.length,
      transactionCount,
      orderCount,
      memberSince: user.createdAt,
      lastLogin: user.lastLoginAt,
    };
  }

  async deactivateUser(userId: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.DEACTIVATED },
    });

    // Revoke all sessions
    await this.prisma.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    this.logger.log(`User ${userId} deactivated`);
    return { message: 'User deactivated successfully', user };
  }

  async reactivateUser(userId: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.ACTIVE },
    });

    this.logger.log(`User ${userId} reactivated`);
    return { message: 'User reactivated successfully', user };
  }

  // Admin functions
  async findAll(
    page = 1,
    limit = 20,
    filters?: { status?: UserStatus; kycStatus?: KYCStatus },
  ) {
    const skip = (page - 1) * limit;

    const where: { status?: UserStatus; kycStatus?: KYCStatus } = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.kycStatus) where.kycStatus = filters.kycStatus;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          phoneNumber: true,
          role: true,
          status: true,
          kycStatus: true,
          createdAt: true,
          lastLoginAt: true,
        },
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

  async getReferralStats(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        referralCode: true,
        totalReferrals: true,
        referrals: {
          select: {
            id: true,
            createdAt: true,
            totalSpent: true,
          },
        },
        rewards: {
          where: { type: 'REFERRAL' as any },
          select: {
            amount: true,
            status: true,
          },
        },
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const successfulReferrals = user.referrals.filter(
      (ref) => parseFloat(ref.totalSpent.toString()) > 0,
    ).length;

    const pendingReferrals = user.referrals.filter(
      (ref) => parseFloat(ref.totalSpent.toString()) === 0,
    ).length;

    const totalEarnings = user.rewards
      .filter((r) => r.status === 'CLAIMED' && r.amount)
      .reduce((sum, r) => sum + parseFloat(r.amount!.toString()), 0);

    const appUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const referralLink = `${appUrl}/login?ref=${user.referralCode}`;

    return {
      totalReferrals: user.totalReferrals,
      successfulReferrals,
      pendingReferrals,
      totalEarnings: totalEarnings.toFixed(2),
      referralCode: user.referralCode,
      referralLink,
    };
  }

  // Profile Update Flow
  async initiateProfileUpdate(userId: string, updateType: 'email' | 'phone') {
    const user = await this.findOne(userId);

    if (!user.email) {
      throw new BadRequestException('User email not found');
    }

    // Generate OTPs for current credentials
    const emailOtp = this.otpService.storeOtp(user.email, 'email');
    const firstName = user.email.split('@')[0];

    await this.emailService.sendOtpEmail(user.email, emailOtp, firstName);

    // Send phone OTP
    if (this.twilioService.isEnabled() && user.phoneNumber) {
      const countryCode = user.countryCode || '+1';
      const phone = user.phoneNumber.replace(countryCode, '');
      await this.twilioService.sendOtp(countryCode, phone);
    } else if (user.phoneNumber) {
      const phoneOtp = this.otpService.storeOtp(user.phoneNumber, 'phone');
      this.logger.log(`[DEV MODE] Phone OTP for ${user.phoneNumber}: ${phoneOtp}`);
    }

    this.logger.log(`Profile update initiated for user ${userId} - updating ${updateType}`);

    return {
      message: 'OTP sent to your current email and phone number',
      expiresIn: 600,
      updateType,
    };
  }

  async verifyCurrentCredentials(
    userId: string,
    emailOtp: string,
    phoneOtp: string,
  ) {
    const user = await this.findOne(userId);

    if (!user.email) {
      throw new BadRequestException('User email not found');
    }

    // Verify email OTP
    const isEmailValid = this.otpService.verifyOtp(user.email, emailOtp, 'email');
    if (!isEmailValid) {
      throw new BadRequestException('Invalid or expired email OTP');
    }

    // Verify phone OTP
    let isPhoneValid = false;
    if (this.twilioService.isEnabled() && user.phoneNumber) {
      const countryCode = user.countryCode || '+1';
      const phone = user.phoneNumber.replace(countryCode, '');
      isPhoneValid = await this.twilioService.verifyOtp(countryCode, phone, phoneOtp);
    } else if (user.phoneNumber) {
      isPhoneValid = this.otpService.verifyOtp(user.phoneNumber, phoneOtp, 'phone');
    }

    if (!isPhoneValid) {
      throw new BadRequestException('Invalid or expired phone OTP');
    }

    this.logger.log(`Current credentials verified for user ${userId}`);

    return {
      message: 'Current credentials verified successfully',
      verified: true,
    };
  }

  async initiateEmailUpdate(userId: string, newEmail: string) {
    const normalizedEmail = newEmail.toLowerCase();

    // Check if email exists and belongs to a different user
    const existingUser = await this.findByEmail(normalizedEmail);
    if (existingUser && existingUser.id !== userId) {
      throw new BadRequestException(
        'This email is already linked to another account',
      );
    }

    // Generate OTP for new email
    const emailOtp = this.otpService.storeOtp(normalizedEmail, 'email');
    const firstName = normalizedEmail.split('@')[0];

    await this.emailService.sendOtpEmail(normalizedEmail, emailOtp, firstName);

    // Store pending update
    this.pendingUpdates.set(userId, {
      type: 'email',
      newValue: normalizedEmail,
      verifiedCurrent: true,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    });

    this.logger.log(`Email update OTP sent to ${normalizedEmail} for user ${userId}`);

    return {
      message: 'OTP sent to new email address',
      expiresIn: 600,
    };
  }

  async verifyEmailUpdate(userId: string, emailOtp: string) {
    const pending = this.pendingUpdates.get(userId);

    if (!pending || pending.type !== 'email') {
      throw new BadRequestException('No pending email update found');
    }

    if (new Date() > pending.expiresAt) {
      this.pendingUpdates.delete(userId);
      throw new BadRequestException('Update session expired. Please start over.');
    }

    // Verify OTP
    const isValid = this.otpService.verifyOtp(pending.newValue, emailOtp, 'email');
    if (!isValid) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    // Update email
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { email: pending.newValue },
    });

    // Clear pending update
    this.pendingUpdates.delete(userId);

    this.logger.log(`Email updated successfully for user ${userId}`);

    return {
      message: 'Email updated successfully',
      user: updatedUser,
    };
  }

  async initiatePhoneUpdate(
    userId: string,
    countryCode: string,
    newPhoneNumber: string,
  ) {
    const fullPhoneNumber = `${countryCode}${newPhoneNumber}`;

    // Check if phone exists and belongs to a different user
    const existingUser = await this.findByPhoneNumber(fullPhoneNumber);
    if (existingUser && existingUser.id !== userId) {
      throw new BadRequestException(
        'This phone number is already linked to another account',
      );
    }

    // Send OTP to new phone number
    if (this.twilioService.isEnabled()) {
      await this.twilioService.sendOtp(countryCode, newPhoneNumber);
    } else {
      const phoneOtp = this.otpService.storeOtp(fullPhoneNumber, 'phone');
      this.logger.log(`[DEV MODE] Phone OTP for ${fullPhoneNumber}: ${phoneOtp}`);
    }

    // Store pending update
    this.pendingUpdates.set(userId, {
      type: 'phone',
      newValue: fullPhoneNumber,
      verifiedCurrent: true,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    });

    this.logger.log(`Phone update OTP sent to ${fullPhoneNumber} for user ${userId}`);

    return {
      message: 'OTP sent to new phone number',
      expiresIn: 600,
    };
  }

  async verifyPhoneUpdate(userId: string, phoneOtp: string) {
    const pending = this.pendingUpdates.get(userId);

    if (!pending || pending.type !== 'phone') {
      throw new BadRequestException('No pending phone update found');
    }

    if (new Date() > pending.expiresAt) {
      this.pendingUpdates.delete(userId);
      throw new BadRequestException('Update session expired. Please start over.');
    }

    // Verify OTP
    let isValid = false;
    if (this.twilioService.isEnabled()) {
      // Extract country code and phone from fullPhoneNumber
      const countryCode = pending.newValue.substring(0, pending.newValue.length - 10);
      const phone = pending.newValue.substring(pending.newValue.length - 10);
      isValid = await this.twilioService.verifyOtp(countryCode, phone, phoneOtp);
    } else {
      isValid = this.otpService.verifyOtp(pending.newValue, phoneOtp, 'phone');
    }

    if (!isValid) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    // Update phone number
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        phoneNumber: pending.newValue,
        countryCode: pending.newValue.substring(0, pending.newValue.length - 10),
      },
    });

    // Clear pending update
    this.pendingUpdates.delete(userId);

    this.logger.log(`Phone number updated successfully for user ${userId}`);

    return {
      message: 'Phone number updated successfully',
      user: updatedUser,
    };
  }

  async deleteAccount(userId: string, confirmationText: string) {
    if (confirmationText !== 'DELETE') {
      throw new BadRequestException('Invalid confirmation text');
    }

    const user = await this.findOne(userId);

    // Check if user has any wallet balance
    const totalBalance = user.wallets.reduce(
      (sum, wallet) => sum + parseFloat(wallet.balance.toString()),
      0,
    );

    // Delete all user data
    await this.prisma.$transaction(async (tx) => {
      // Delete wallets
      await tx.wallet.deleteMany({ where: { userId } });

      // Delete transactions
      await tx.transaction.deleteMany({ where: { userId } });

      // Delete orders
      await tx.order.deleteMany({ where: { userId } });

      // Delete sessions
      await tx.userSession.deleteMany({ where: { userId } });

      // Delete addresses
      await tx.userAddress.deleteMany({ where: { userId } });

      // Delete favorites
      await tx.favorite.deleteMany({ where: { userId } });

      // Delete API keys
      await tx.apiKey.deleteMany({ where: { userId } });

      // Delete rewards
      await tx.reward.deleteMany({ where: { userId } });

      // Finally delete user
      await tx.user.delete({ where: { id: userId } });
    });

    this.logger.log(
      `Account deleted for user ${userId}. Total balance removed: $${totalBalance.toFixed(2)}`,
    );

    return {
      message: 'Account deleted successfully',
      balanceRemoved: totalBalance.toFixed(2),
    };
  }
}
