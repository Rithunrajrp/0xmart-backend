import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserStatus, KYCStatus } from '@prisma/client';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private prisma: PrismaService) {}

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
}
