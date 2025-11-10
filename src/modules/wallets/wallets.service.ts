import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { TransferOutDto } from './dto/transfer-out.dto';
import { AddressGeneratorService } from './services/address-generator.service';
import { BlockchainService } from './services/blockchain.service';
import { TransactionStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class WalletsService {
  private readonly logger = new Logger(WalletsService.name);

  constructor(
    private prisma: PrismaService,
    private addressGenerator: AddressGeneratorService,
    private blockchain: BlockchainService,
  ) {}

  async createWallet(userId: string, createWalletDto: CreateWalletDto) {
    const { stablecoinType, network } = createWalletDto;

    // Check if wallet already exists
    const existingWallet = await this.prisma.wallet.findUnique({
      where: {
        userId_stablecoinType_network: {
          userId,
          stablecoinType,
          network,
        },
      },
    });

    if (existingWallet) {
      return existingWallet;
    }

    // Count existing wallets for index
    const walletCount = await this.prisma.wallet.count({ where: { userId } });

    // Generate new deposit address
    const { address } = await this.addressGenerator.generateDepositAddress(
      userId,
      walletCount,
    );

    // Create wallet
    const wallet = await this.prisma.wallet.create({
      data: {
        userId,
        stablecoinType,
        network,
        depositAddress: address,
        balance: 0,
        lockedBalance: 0,
      },
    });

    this.logger.log(
      `Wallet created for user ${userId}: ${stablecoinType} on ${network}`,
    );

    return wallet;
  }

  async getUserWallets(userId: string) {
    return this.prisma.wallet.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getWallet(walletId: string, userId: string) {
    const wallet = await this.prisma.wallet.findFirst({
      where: { id: walletId, userId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    return wallet;
  }

  async getWalletByAddress(address: string) {
    return this.prisma.wallet.findUnique({
      where: { depositAddress: address },
    });
  }

  async updateBalance(
    walletId: string,
    amount: Decimal,
    operation: 'add' | 'subtract',
  ) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const currentBalance = new Decimal(wallet.balance.toString());
    let newBalance: Decimal;

    if (operation === 'add') {
      newBalance = currentBalance.add(amount);
    } else {
      newBalance = currentBalance.sub(amount);
      if (newBalance.lessThan(0)) {
        throw new BadRequestException('Insufficient balance');
      }
    }

    return this.prisma.wallet.update({
      where: { id: walletId },
      data: { balance: newBalance },
    });
  }

  async lockBalance(walletId: string, amount: Decimal) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const availableBalance = new Decimal(wallet.balance.toString()).sub(
      new Decimal(wallet.lockedBalance.toString()),
    );

    if (availableBalance.lessThan(amount)) {
      throw new BadRequestException('Insufficient available balance');
    }

    return this.prisma.wallet.update({
      where: { id: walletId },
      data: {
        lockedBalance: new Decimal(wallet.lockedBalance.toString()).add(amount),
      },
    });
  }

  async unlockBalance(walletId: string, amount: Decimal) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    return this.prisma.wallet.update({
      where: { id: walletId },
      data: {
        lockedBalance: new Decimal(wallet.lockedBalance.toString()).sub(amount),
      },
    });
  }

  async initiateWithdrawal(userId: string, transferOutDto: TransferOutDto) {
    const { stablecoinType, network, toAddress, amount } = transferOutDto;

    // Validate address
    if (!this.addressGenerator.isValidAddress(toAddress, network)) {
      throw new BadRequestException('Invalid destination address');
    }

    // Find wallet
    const wallet = await this.prisma.wallet.findUnique({
      where: {
        userId_stablecoinType_network: {
          userId,
          stablecoinType,
          network,
        },
      },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const amountDecimal = new Decimal(amount);
    const availableBalance = new Decimal(wallet.balance.toString()).sub(
      new Decimal(wallet.lockedBalance.toString()),
    );

    if (availableBalance.lessThan(amountDecimal)) {
      throw new BadRequestException('Insufficient balance');
    }

    // Estimate network fee (simplified)
    const networkFee = new Decimal('0.001'); // This should be dynamic based on network

    // Create withdrawal record
    const withdrawal = await this.prisma.withdrawal.create({
      data: {
        walletId: wallet.id,
        toAddress,
        amount: amountDecimal,
        networkFee,
        network,
        status: TransactionStatus.PENDING,
      },
    });

    // Lock balance
    await this.lockBalance(wallet.id, amountDecimal.add(networkFee));

    // Create transaction record
    await this.prisma.transaction.create({
      data: {
        userId,
        type: 'WITHDRAWAL',
        status: TransactionStatus.PENDING,
        stablecoinType,
        network,
        amount: amountDecimal,
        fee: networkFee,
        toAddress,
      },
    });

    this.logger.log(
      `Withdrawal initiated: ${withdrawal.id} for user ${userId}`,
    );

    return {
      withdrawalId: withdrawal.id,
      amount: amount,
      networkFee: networkFee.toString(),
      status: 'PENDING',
      message: 'Withdrawal request submitted. It will be processed shortly.',
    };
  }

  async getWalletTransactions(walletId: string, userId: string) {
    const wallet = await this.getWallet(walletId, userId);

    const [deposits, withdrawals] = await Promise.all([
      this.prisma.deposit.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.withdrawal.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    return {
      deposits,
      withdrawals,
    };
  }
}
