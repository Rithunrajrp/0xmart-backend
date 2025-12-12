import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { BlockchainService } from '../wallets/services/blockchain.service';
import { AddressGeneratorService } from '../wallets/services/address-generator.service';
import { EmailService } from '../auth/services/email.service';
import { BigNumber, ethers } from 'ethers';
import { NetworkType, StablecoinType, TransactionStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { ConfigService } from '@nestjs/config';

interface TokenConfig {
  address: string;
  decimals: number;
}

@Injectable()
export class WithdrawalProcessorService {
  private readonly logger = new Logger(WithdrawalProcessorService.name);
  private isProcessing = false;

  // ERC20 token addresses per network
  private readonly tokenAddresses: Record<
    NetworkType,
    Record<StablecoinType, TokenConfig>
  > = {
    ETHEREUM: {
      USDT: {
        address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        decimals: 6,
      },
      USDC: {
        address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        decimals: 6,
      },
      DAI: {
        address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        decimals: 18,
      },
      BUSD: {
        address: '0x4Fabb145d64652a948d72533023f6E7A623C7C53',
        decimals: 18,
      },
    },
    POLYGON: {
      USDT: {
        address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
        decimals: 6,
      },
      USDC: {
        address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
        decimals: 6,
      },
      DAI: {
        address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
        decimals: 18,
      },
      BUSD: {
        address: '0xdAb529f40E671A1D4bF91361c21bf9f0C9712ab7',
        decimals: 18,
      },
    },
    BSC: {
      USDT: {
        address: '0x55d398326f99059fF775485246999027B3197955',
        decimals: 18,
      },
      USDC: {
        address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
        decimals: 18,
      },
      DAI: {
        address: '0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3',
        decimals: 18,
      },
      BUSD: {
        address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
        decimals: 18,
      },
    },
    ARBITRUM: {
      USDT: {
        address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
        decimals: 6,
      },
      USDC: {
        address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
        decimals: 6,
      },
      DAI: {
        address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
        decimals: 18,
      },
      BUSD: {
        address: '0x0000000000000000000000000000000000000000',
        decimals: 18,
      },
    },
    OPTIMISM: {
      USDT: {
        address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
        decimals: 6,
      },
      USDC: {
        address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
        decimals: 6,
      },
      DAI: {
        address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
        decimals: 18,
      },
      BUSD: {
        address: '0x0000000000000000000000000000000000000000',
        decimals: 18,
      },
    },
    AVALANCHE: {
      USDT: {
        address: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
        decimals: 6,
      },
      USDC: {
        address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
        decimals: 6,
      },
      DAI: {
        address: '0xd586E7F844cEa2F87f50152665BCbc2C279D8d70',
        decimals: 18,
      },
      BUSD: {
        address: '0x0000000000000000000000000000000000000000',
        decimals: 18,
      },
    },
    BASE: {
      USDT: {
        address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
        decimals: 6,
      },
      USDC: {
        address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        decimals: 6,
      },
      DAI: {
        address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
        decimals: 18,
      },
      BUSD: {
        address: '0x0000000000000000000000000000000000000000',
        decimals: 18,
      },
    },
    SUI: {
      USDT: {
        address: '0x0000000000000000000000000000000000000000',
        decimals: 9,
      },
      USDC: {
        address: '0x0000000000000000000000000000000000000000',
        decimals: 9,
      },
      DAI: {
        address: '0x0000000000000000000000000000000000000000',
        decimals: 9,
      },
      BUSD: {
        address: '0x0000000000000000000000000000000000000000',
        decimals: 9,
      },
    },
    TON: {
      USDT: {
        address: '0x0000000000000000000000000000000000000000',
        decimals: 6,
      },
      USDC: {
        address: '0x0000000000000000000000000000000000000000',
        decimals: 6,
      },
      DAI: {
        address: '0x0000000000000000000000000000000000000000',
        decimals: 18,
      },
      BUSD: {
        address: '0x0000000000000000000000000000000000000000',
        decimals: 18,
      },
    },
    SOLANA: {
      USDT: {
        address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
        decimals: 6,
      }, // USDT SPL Token
      USDC: {
        address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        decimals: 6,
      }, // USDC SPL Token
      DAI: {
        address: 'EjmyN6qEC1Tf1JxiG1ae7UTJhUxSwk1TCWNWqxWV4J6o',
        decimals: 8,
      }, // DAI SPL Token
      BUSD: {
        address: 'AJ1W9A9N9dEMdVyoDiam2rV44gnBm2csrPDP7xqcapgX',
        decimals: 8,
      }, // BUSD SPL Token
    },
  };

  // ERC20 Transfer ABI
  private readonly ERC20_ABI = [
    'function transfer(address to, uint256 amount) returns (bool)',
    'function balanceOf(address account) view returns (uint256)',
    'function decimals() view returns (uint8)',
  ];

  // Hot wallet private key (should be in secure vault in production)
  private hotWalletPrivateKey: string;

  constructor(
    private prisma: PrismaService,
    private blockchain: BlockchainService,
    private addressGenerator: AddressGeneratorService,
    private emailService: EmailService,
    private configService: ConfigService,
  ) {
    // In production, load from AWS Secrets Manager or HashiCorp Vault
    this.hotWalletPrivateKey = this.configService.get<string>(
      'HOT_WALLET_PRIVATE_KEY',
    ) as string;

    if (!this.hotWalletPrivateKey) {
      this.logger.warn(
        '⚠️ Hot wallet private key not configured. Withdrawals will not be processed.',
      );
    } else {
      this.logger.log('✅ Withdrawal processor initialized');
    }
  }
  // Withdrawal limits based on KYC level (example values)
  private readonly withdrawalLimits = {
    NOT_STARTED: 0, // Cannot withdraw at all
    PENDING: 100, // Max $100 total withdrawal
    APPROVED: 10000, // Max $10,000 total withdrawal
    REJECTED: 0, // Cannot withdraw
    EXPIRED: 0, // Cannot withdraw
  };

  // Run every minute
  @Cron('0 * * * * *')
  async processWithdrawals() {
    if (this.isProcessing) {
      this.logger.debug('Processor already running, skipping...');
      return;
    }

    if (!this.hotWalletPrivateKey) {
      return;
    }

    this.isProcessing = true;

    try {
      await this.processPendingWithdrawals();
      await this.checkWithdrawalConfirmations();
    } catch (error) {
      this.logger.error(`Processor error: ${error.message}`);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processPendingWithdrawals() {
    // Get pending withdrawals that need approval
    const pendingWithdrawals = await this.prisma.withdrawal.findMany({
      where: {
        status: TransactionStatus.PENDING,
        approvedAt: { not: null }, // Only process approved withdrawals
      },
      include: {
        wallet: {
          include: {
            user: true,
          },
        },
      },
      take: 10, // Process 10 at a time
      orderBy: { createdAt: 'asc' },
    });

    if (pendingWithdrawals.length === 0) {
      this.logger.debug('No pending withdrawals to process');
      return;
    }

    this.logger.log(
      `Processing ${pendingWithdrawals.length} pending withdrawals`,
    );

    for (const withdrawal of pendingWithdrawals) {
      try {
        await this.processWithdrawal(withdrawal);
      } catch (error) {
        this.logger.error(
          `Failed to process withdrawal ${withdrawal.id}: ${error.message}`,
        );
        await this.handleWithdrawalFailure(
          withdrawal.id,
          error.message as string,
        );
      }
    }
  }

  private async processWithdrawal(withdrawal: any) {
    const { id, walletId, toAddress, amount, network } = withdrawal;
    const wallet = withdrawal.wallet;
    const stablecoinType = wallet.stablecoinType;
    const user = withdrawal.wallet.user;
    const kycStatus = user.kycStatus;

    if (
      kycStatus === 'NOT_STARTED' ||
      kycStatus === 'REJECTED' ||
      kycStatus === 'EXPIRED'
    ) {
      throw new Error('User KYC not verified. Withdrawal not allowed.');
    }

    this.logger.log(
      `Processing withdrawal: from ${walletId} ${amount} ${stablecoinType} to ${toAddress} on ${network}`,
    );

    // Get token config
    const tokenConfig = this.tokenAddresses[network][stablecoinType];
    if (
      !tokenConfig ||
      tokenConfig.address === '0x0000000000000000000000000000000000000000'
    ) {
      throw new Error(`Token ${stablecoinType} not available on ${network}`);
    }

    // Update status to PROCESSING
    await this.prisma.withdrawal.update({
      where: { id },
      data: { status: TransactionStatus.PROCESSING },
    });

    // Get provider and create signer
    const provider = this.blockchain.getProvider(network as NetworkType);
    const signer = new ethers.Wallet(this.hotWalletPrivateKey, provider);

    // Check hot wallet balance
    const hotWalletAddress = signer.address;
    const contract = new ethers.Contract(
      tokenConfig.address as string,
      this.ERC20_ABI,
      signer,
    );
    const hotWalletBalance = await contract.balanceOf(hotWalletAddress);

    const requiredAmount = ethers.utils.parseUnits(
      amount.toString() as string,
      tokenConfig.decimals as number,
    );

    if (hotWalletBalance.lt(requiredAmount)) {
      throw new Error(
        `Insufficient hot wallet balance. Required: ${amount}, Available: ${ethers.utils.formatUnits(hotWalletBalance as BigNumber, tokenConfig.decimals as number)}`,
      );
    }

    // Estimate gas
    const gasLimit = await contract.estimateGas.transfer(
      toAddress,
      requiredAmount,
    );
    const gasPrice = await provider.getGasPrice();
    const estimatedGasCost = gasLimit.mul(gasPrice);

    // Check ETH/MATIC balance for gas
    const nativeBalance = await signer.getBalance();
    if (nativeBalance.lt(estimatedGasCost)) {
      throw new Error(
        `Insufficient gas balance. Required: ${ethers.utils.formatEther(estimatedGasCost)}, Available: ${ethers.utils.formatEther(nativeBalance)}`,
      );
    }

    // Execute transfer
    this.logger.log(
      `Executing transfer: ${amount} ${stablecoinType} to ${toAddress}`,
    );

    const tx = await contract.transfer(toAddress, requiredAmount, {
      gasLimit: gasLimit.mul(120).div(100), // Add 20% buffer
      gasPrice: gasPrice.mul(110).div(100), // Add 10% to gas price for faster confirmation
    });

    this.logger.log(`Transaction broadcasted: ${tx.hash}`);

    // Update withdrawal with tx hash
    await this.prisma.withdrawal.update({
      where: { id },
      data: {
        txHash: tx.hash,
        processedAt: new Date(),
      },
    });

    // Update transaction record
    await this.prisma.transaction.updateMany({
      where: {
        userId: wallet.userId,
        type: 'WITHDRAWAL',
        toAddress: toAddress,
        amount: new Decimal(amount.toString() as string),
      },
      data: {
        txHash: tx.hash,
        status: TransactionStatus.PROCESSING,
      },
    });

    this.logger.log(
      `Withdrawal ${id} broadcasted successfully. TX: ${tx.hash}`,
    );
  }

  private async checkWithdrawalConfirmations() {
    // Get processing withdrawals
    const processingWithdrawals = await this.prisma.withdrawal.findMany({
      where: {
        status: TransactionStatus.PROCESSING,
        txHash: { not: null },
      },
      include: {
        wallet: {
          include: {
            user: true,
          },
        },
      },
    });

    if (processingWithdrawals.length === 0) {
      return;
    }

    this.logger.debug(
      `Checking ${processingWithdrawals.length} processing withdrawals`,
    );

    for (const withdrawal of processingWithdrawals) {
      try {
        const provider = this.blockchain.getProvider(withdrawal.network);
        const receipt = await provider.getTransactionReceipt(
          withdrawal.txHash as string,
        );

        if (receipt) {
          if (receipt.status === 1) {
            // Transaction succeeded
            await this.confirmWithdrawal(withdrawal);
          } else {
            // Transaction failed
            await this.handleWithdrawalFailure(
              withdrawal.id,
              'Transaction failed on blockchain',
            );
          }
        }
      } catch (error) {
        this.logger.error(
          `Error checking withdrawal ${withdrawal.id}: ${error.message}`,
        );
      }
    }
  }

  private async confirmWithdrawal(withdrawal: any) {
    this.logger.log(
      `Confirming withdrawal ${withdrawal.id}: ${withdrawal.amount} ${withdrawal.wallet.stablecoinType}`,
    );

    // Update withdrawal status
    await this.prisma.withdrawal.update({
      where: { id: withdrawal.id },
      data: {
        status: TransactionStatus.COMPLETED,
        completedAt: new Date(),
      },
    });

    // Update transaction
    await this.prisma.transaction.updateMany({
      where: {
        txHash: withdrawal.txHash,
      },
      data: {
        status: TransactionStatus.COMPLETED,
      },
    });

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        userId: withdrawal.wallet.userId,
        action: 'WITHDRAWAL_COMPLETED',
        entityType: 'withdrawal',
        entityId: withdrawal.id,
        metadata: {
          amount: withdrawal.amount.toString(),
          stablecoinType: withdrawal.wallet.stablecoinType,
          toAddress: withdrawal.toAddress,
          txHash: withdrawal.txHash,
        },
      },
    });

    // Send notification
    await this.sendWithdrawalNotification(withdrawal, 'completed');

    this.logger.log(`Withdrawal ${withdrawal.id} completed successfully`);
  }

  private async handleWithdrawalFailure(withdrawalId: string, reason: string) {
    this.logger.error(`Withdrawal ${withdrawalId} failed: ${reason}`);

    const withdrawal = await this.prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
      include: {
        wallet: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!withdrawal) return;

    // Update status to FAILED
    await this.prisma.withdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: TransactionStatus.FAILED,
        failureReason: reason,
      },
    });

    // Unlock the balance in wallet
    const totalAmount = new Decimal(withdrawal.amount.toString()).add(
      new Decimal(withdrawal.networkFee.toString()),
    );

    await this.prisma.wallet.update({
      where: { id: withdrawal.walletId },
      data: {
        lockedBalance: {
          decrement: totalAmount,
        },
      },
    });

    // Update transaction
    await this.prisma.transaction.updateMany({
      where: {
        userId: withdrawal.wallet.userId,
        type: 'WITHDRAWAL',
        toAddress: withdrawal.toAddress,
        amount: new Decimal(withdrawal.amount.toString()),
      },
      data: {
        status: TransactionStatus.FAILED,
        failureReason: reason,
      },
    });

    // Send notification
    await this.sendWithdrawalNotification(withdrawal, 'failed', reason);
  }

  private async sendWithdrawalNotification(
    withdrawal: any,
    status: 'completed' | 'failed',
    reason?: string,
  ) {
    const user = withdrawal.wallet.user;
    const amount = withdrawal.amount.toString();
    const stablecoin = withdrawal.wallet.stablecoinType;
    const txHash = withdrawal.txHash;

    try {
      if (status === 'completed') {
        await this.emailService.sendWithdrawalCompletedEmail(
          user.email as string,
          user.id as string,
          amount as string,
          stablecoin as StablecoinType,
          withdrawal.toAddress as string,
          txHash as string,
          withdrawal.network as NetworkType,
        );
      } else {
        await this.emailService.sendWithdrawalFailedEmail(
          user.email as string,
          user.id as string,
          amount as string,
          stablecoin as StablecoinType,
          reason as string,
        );
      }

      // Create notification record
      await this.prisma.notification.create({
        data: {
          userId: user.id,
          type:
            status === 'completed' ? 'WITHDRAWAL_COMPLETED' : 'PAYMENT_FAILED',
          channel: 'EMAIL',
          recipient: user.email,
          subject:
            status === 'completed'
              ? 'Withdrawal Completed'
              : 'Withdrawal Failed',
          message:
            status === 'completed'
              ? `Your withdrawal of ${amount} ${stablecoin} has been completed.`
              : `Your withdrawal of ${amount} ${stablecoin} failed: ${reason}`,
          status: 'sent',
          sentAt: new Date(),
          metadata: {
            amount,
            stablecoin,
            txHash,
            toAddress: withdrawal.toAddress,
            reason,
          },
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to send withdrawal notification: ${error.message}`,
      );
    }
  }

  // Manual approval for admin
  async approveWithdrawal(withdrawalId: string, adminId: string) {
    const withdrawal = await this.prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
      include: {
        wallet: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!withdrawal) {
      throw new BadRequestException('Withdrawal not found');
    }

    if (withdrawal.status !== TransactionStatus.PENDING) {
      throw new BadRequestException('Withdrawal already processed');
    }

    const user = withdrawal.wallet.user;

    // 🧠 Step 2: Apply withdrawal limit based on KYC status
    const kycStatus = user.kycStatus; // 'NOT_STARTED', 'PENDING', 'APPROVED', 'REJECTED', 'EXPIRED'
    const limit = this.withdrawalLimits[kycStatus] ?? 0;

    if (limit === undefined || limit === null) {
      throw new BadRequestException('Invalid KYC status');
    }

    // Calculate total withdrawals for this user in the past 24h or lifetime (you can decide)
    const totalWithdrawn = await this.prisma.withdrawal.aggregate({
      where: {
        wallet: { userId: user.id },
        status: TransactionStatus.COMPLETED,
      },
      _sum: { amount: true },
    });

    const totalAmount = new Decimal(
      totalWithdrawn._sum.amount?.toString() || '0',
    );
    const newTotal = totalAmount.add(withdrawal.amount);

    if (newTotal.gt(limit)) {
      throw new BadRequestException(
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        `Withdrawal exceeds your KYC limit. Max allowed: ${limit}, Current total: ${totalAmount}`,
      );
    }

    // ✅ Approve withdrawal if within limit
    await this.prisma.withdrawal.update({
      where: { id: withdrawalId },
      data: {
        approvedBy: adminId,
        approvedAt: new Date(),
      },
    });

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        userId: withdrawal.wallet.userId,
        action: 'WITHDRAWAL_APPROVED',
        entityType: 'withdrawal',
        entityId: withdrawalId,
        metadata: {
          approvedBy: adminId,
          amount: withdrawal.amount.toString(),
          toAddress: withdrawal.toAddress,
        },
      },
    });

    this.logger.log(`Withdrawal ${withdrawalId} approved by admin ${adminId}`);

    return {
      success: true,
      message: 'Withdrawal approved and queued for processing',
    };
  }

  async rejectWithdrawal(
    withdrawalId: string,
    adminId: string,
    reason: string,
  ) {
    const withdrawal = await this.prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
      include: {
        wallet: true,
      },
    });

    if (!withdrawal) {
      throw new BadRequestException('Withdrawal not found');
    }

    if (withdrawal.status !== TransactionStatus.PENDING) {
      throw new BadRequestException('Withdrawal already processed');
    }

    // Reject withdrawal
    await this.prisma.withdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: TransactionStatus.CANCELLED,
        failureReason: `Rejected by admin: ${reason}`,
      },
    });

    // Unlock balance

    const totalAmount = new Decimal(withdrawal.amount.toString()).add(
      new Decimal(withdrawal.networkFee.toString()),
    );

    await this.prisma.wallet.update({
      where: { id: withdrawal.walletId },
      data: {
        lockedBalance: {
          decrement: totalAmount,
        },
      },
    });

    // Update transaction
    await this.prisma.transaction.updateMany({
      where: {
        userId: withdrawal.wallet.userId,
        type: 'WITHDRAWAL',
        toAddress: withdrawal.toAddress,
        status: TransactionStatus.PENDING,
      },
      data: {
        status: TransactionStatus.CANCELLED,
        failureReason: `Rejected: ${reason}`,
      },
    });

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        userId: withdrawal.wallet.userId,
        action: 'ADMIN_ACTION',
        entityType: 'withdrawal',
        entityId: withdrawalId,
        metadata: {
          action: 'reject',
          rejectedBy: adminId,
          reason,
        },
      },
    });

    this.logger.log(`Withdrawal ${withdrawalId} rejected by admin ${adminId}`);

    return {
      success: true,
      message: 'Withdrawal rejected and balance unlocked',
    };
  }

  getPendingWithdrawals() {
    return this.prisma.withdrawal.findMany({
      where: {
        status: TransactionStatus.PENDING,
      },
      include: {
        wallet: {
          include: {
            user: {
              select: {
                email: true,
                kycStatus: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getWithdrawalStatus(txHash: string) {
    const withdrawal = await this.prisma.withdrawal.findUnique({
      where: { txHash },
      include: {
        wallet: {
          select: {
            stablecoinType: true,
            network: true,
          },
        },
      },
    });

    if (!withdrawal) {
      return null;
    }

    return {
      id: withdrawal.id,
      txHash: withdrawal.txHash,
      amount: withdrawal.amount.toString(),
      networkFee: withdrawal.networkFee.toString(),
      stablecoinType: withdrawal.wallet.stablecoinType,
      network: withdrawal.wallet.network,
      toAddress: withdrawal.toAddress,
      status: withdrawal.status,
      createdAt: withdrawal.createdAt,
      processedAt: withdrawal.processedAt,
      completedAt: withdrawal.completedAt,
      failureReason: withdrawal.failureReason,
    };
  }

  // Manual trigger for testing
  async manualProcess() {
    this.logger.log('Manual withdrawal processing triggered');
    await this.processPendingWithdrawals();
    await this.checkWithdrawalConfirmations();
    return { success: true, message: 'Processing completed' };
  }
}
