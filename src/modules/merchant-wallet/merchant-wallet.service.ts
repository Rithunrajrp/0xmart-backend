import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreateMerchantWalletDto,
  UpdateMerchantWalletDto,
} from './dto';
import { NetworkType, StablecoinType } from '@prisma/client';

@Injectable()
export class MerchantWalletService {
  constructor(private readonly prisma: PrismaService) {}

  async createWallet(sellerId: string, dto: CreateMerchantWalletDto) {
    // Verify seller exists
    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
    });

    if (!seller) {
      throw new NotFoundException('Seller not found');
    }

    // Check if wallet already exists for this network/stablecoin
    const existing = await this.prisma.merchantWallet.findUnique({
      where: {
        sellerId_network_stablecoinType: {
          sellerId,
          network: dto.network,
          stablecoinType: dto.stablecoinType,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Wallet already exists for ${dto.network} ${dto.stablecoinType}. Use update instead.`,
      );
    }

    // If setting as default, unset other defaults
    if (dto.isDefault) {
      await this.prisma.merchantWallet.updateMany({
        where: {
          sellerId,
          stablecoinType: dto.stablecoinType,
          isDefault: true,
        },
        data: { isDefault: false },
      });
    }

    // Create the wallet
    const wallet = await this.prisma.merchantWallet.create({
      data: {
        sellerId,
        network: dto.network,
        stablecoinType: dto.stablecoinType,
        walletAddress: dto.walletAddress.toLowerCase(),
        label: dto.label,
        isDefault: dto.isDefault || false,
      },
    });

    // Create merchant balance record if not exists
    await this.prisma.merchantBalance.upsert({
      where: {
        sellerId_stablecoinType: {
          sellerId,
          stablecoinType: dto.stablecoinType,
        },
      },
      update: {},
      create: {
        sellerId,
        stablecoinType: dto.stablecoinType,
      },
    });

    return wallet;
  }

  async getWallets(sellerId: string) {
    return this.prisma.merchantWallet.findMany({
      where: { sellerId },
      orderBy: [{ stablecoinType: 'asc' }, { network: 'asc' }],
    });
  }

  async getWallet(sellerId: string, walletId: string) {
    const wallet = await this.prisma.merchantWallet.findFirst({
      where: { id: walletId, sellerId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    return wallet;
  }

  async getDefaultWallet(sellerId: string, stablecoinType: StablecoinType) {
    const wallet = await this.prisma.merchantWallet.findFirst({
      where: {
        sellerId,
        stablecoinType,
        isDefault: true,
      },
    });

    if (!wallet) {
      // Fallback to any wallet for this stablecoin
      return this.prisma.merchantWallet.findFirst({
        where: { sellerId, stablecoinType },
      });
    }

    return wallet;
  }

  async updateWallet(
    sellerId: string,
    walletId: string,
    dto: UpdateMerchantWalletDto,
  ) {
    const wallet = await this.getWallet(sellerId, walletId);

    // If setting as default, unset other defaults
    if (dto.isDefault) {
      await this.prisma.merchantWallet.updateMany({
        where: {
          sellerId,
          stablecoinType: wallet.stablecoinType,
          isDefault: true,
          id: { not: walletId },
        },
        data: { isDefault: false },
      });
    }

    // If changing address, mark as unverified
    const updateData: any = {
      ...dto,
    };

    if (dto.walletAddress) {
      updateData.walletAddress = dto.walletAddress.toLowerCase();
      updateData.isVerified = false;
      updateData.verifiedAt = null;
      updateData.verifiedBy = null;
    }

    return this.prisma.merchantWallet.update({
      where: { id: walletId },
      data: updateData,
    });
  }

  async deleteWallet(sellerId: string, walletId: string) {
    const wallet = await this.getWallet(sellerId, walletId);

    // Check if there are pending settlements to this wallet
    const pendingSettlements = await this.prisma.settlement.count({
      where: {
        sellerId,
        network: wallet.network,
        stablecoinType: wallet.stablecoinType,
        status: { in: ['PENDING', 'APPROVED', 'PROCESSING'] },
      },
    });

    if (pendingSettlements > 0) {
      throw new BadRequestException(
        'Cannot delete wallet with pending settlements',
      );
    }

    return this.prisma.merchantWallet.delete({
      where: { id: walletId },
    });
  }

  async verifyWallet(walletId: string, verifiedBy: string) {
    return this.prisma.merchantWallet.update({
      where: { id: walletId },
      data: {
        isVerified: true,
        verifiedAt: new Date(),
        verifiedBy,
      },
    });
  }

  async getMerchantBalance(sellerId: string, stablecoinType?: StablecoinType) {
    if (stablecoinType) {
      return this.prisma.merchantBalance.findUnique({
        where: {
          sellerId_stablecoinType: { sellerId, stablecoinType },
        },
      });
    }

    return this.prisma.merchantBalance.findMany({
      where: { sellerId },
    });
  }

  async getMerchantEarningsSummary(sellerId: string) {
    const balances = await this.prisma.merchantBalance.findMany({
      where: { sellerId },
    });

    const wallets = await this.prisma.merchantWallet.findMany({
      where: { sellerId },
    });

    // Get recent settlements
    const recentSettlements = await this.prisma.settlement.findMany({
      where: { sellerId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Get pending orders value
    const pendingOrders = await this.prisma.orderItem.aggregate({
      where: {
        product: { sellerId },
        order: { status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPED'] } },
      },
      _sum: { totalPrice: true },
    });

    return {
      balances: balances.map((b) => ({
        stablecoinType: b.stablecoinType,
        pendingBalance: b.pendingBalance.toString(),
        availableBalance: b.availableBalance.toString(),
        totalEarned: b.totalEarned.toString(),
        totalSettled: b.totalSettled.toString(),
        totalCommission: b.totalCommission.toString(),
      })),
      wallets: wallets.map((w) => ({
        id: w.id,
        network: w.network,
        stablecoinType: w.stablecoinType,
        walletAddress: w.walletAddress,
        label: w.label,
        isDefault: w.isDefault,
        isVerified: w.isVerified,
      })),
      recentSettlements: recentSettlements.map((s) => ({
        id: s.id,
        settlementNumber: s.settlementNumber,
        netAmount: s.netAmount.toString(),
        stablecoinType: s.stablecoinType,
        network: s.network,
        status: s.status,
        completedAt: s.completedAt,
      })),
      pendingOrdersValue: pendingOrders._sum.totalPrice?.toString() || '0',
    };
  }

  async getSupportedNetworks(): Promise<NetworkType[]> {
    // Return networks that support settlements
    return [
      'POLYGON',
      'ETHEREUM',
      'BSC',
      'ARBITRUM',
      'OPTIMISM',
      'BASE',
      'AVALANCHE',
    ];
  }

  async getSupportedStablecoins(): Promise<StablecoinType[]> {
    return ['USDT', 'USDC'];
  }
}
