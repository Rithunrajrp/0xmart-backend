import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { BlockchainService } from '../wallets/services/blockchain.service';
import { EmailService } from '../auth/services/email.service';
import { BigNumber, BytesLike, ethers } from 'ethers';
import { NetworkType, StablecoinType, TransactionStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

interface TokenConfig {
  address: string;
  decimals: number;
}

@Injectable()
export class DepositMonitorService {
  private readonly logger = new Logger(DepositMonitorService.name);
  private isMonitoring = false;

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
      }, // Not available
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
      }, // Not available
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
      }, // Not available
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
      }, // Not available
    },
    SUI: {
      USDT: {
        address: '0x0000000000000000000000000000000000000000',
        decimals: 9,
      }, // SUI uses different token standard
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
      }, // TON uses different address format
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

  // Required confirmations per network
  private readonly requiredConfirmations: Record<NetworkType, number> = {
    ETHEREUM: 12,
    POLYGON: 128,
    BSC: 15,
    ARBITRUM: 10,
    OPTIMISM: 10,
    AVALANCHE: 1, // Avalanche C-Chain has fast finality
    BASE: 12, // Similar to Ethereum
    SUI: 1, // Sui has instant finality
    TON: 1, // TON has fast finality
    SOLANA: 32, // Solana requires 32 confirmations for finality
  };

  // ERC20 Transfer event ABI
  private readonly TRANSFER_EVENT_ABI = [
    'event Transfer(address indexed from, address indexed to, uint256 value)',
  ];

  constructor(
    private prisma: PrismaService,
    private blockchain: BlockchainService,
    private emailService: EmailService,
  ) {}

  // Run every 30 seconds
  @Cron('*/30 * * * * *')
  async monitorDeposits() {
    if (this.isMonitoring) {
      this.logger.debug('Monitor already running, skipping...');
      return;
    }

    this.isMonitoring = true;

    try {
      await this.scanForNewDeposits();
      await this.updatePendingDeposits();
    } catch (error) {
      this.logger.error(`Monitor error: ${error.message}`);
    } finally {
      this.isMonitoring = false;
    }
  }

  private async scanForNewDeposits() {
    // Get all wallets with deposit addresses
    const wallets = await this.prisma.wallet.findMany({
      select: {
        id: true,
        userId: true,
        depositAddress: true,
        stablecoinType: true,
        network: true,
      },
    });

    this.logger.debug(`Scanning ${wallets.length} wallets for deposits`);

    for (const wallet of wallets) {
      try {
        await this.checkWalletForDeposits(wallet);
      } catch (error) {
        this.logger.error(
          `Error checking wallet ${wallet.id}: ${error.message}`,
        );
      }
    }
  }

  private async checkWalletForDeposits(wallet: any) {
    const { network } = wallet;

    // Route to appropriate monitoring method based on network
    if (network === 'SOLANA') {
      return this.checkSolanaWalletForDeposits(wallet);
    }

    if (network === 'TON') {
      return this.checkTonWalletForDeposits(wallet);
    }

    if (network === 'SUI') {
      return this.checkSuiWalletForDeposits(wallet);
    }

    // EVM chains (Ethereum, Polygon, BSC, etc.)
    return this.checkEvmWalletForDeposits(wallet);
  }

  private async checkEvmWalletForDeposits(wallet: any) {
    const {
      network,
      stablecoinType,
      depositAddress,
      id: walletId,
      userId,
    } = wallet;

    // Get token config
    const tokenConfig = this.tokenAddresses[network]?.[stablecoinType];
    if (
      !tokenConfig ||
      tokenConfig.address === '0x0000000000000000000000000000000000000000'
    ) {
      return; // Token not available on this network
    }

    // Get provider
    const provider = this.blockchain.getProvider(network as NetworkType);

    // Create contract interface
    const iface = new ethers.utils.Interface(this.TRANSFER_EVENT_ABI);

    // Get latest processed block for this wallet
    const lastDeposit = await this.prisma.deposit.findFirst({
      where: { walletId },
      orderBy: { blockNumber: 'desc' },
    });

    const fromBlock = lastDeposit?.blockNumber
      ? Number(lastDeposit.blockNumber) + 1
      : (await provider.getBlockNumber()) - 1000; // Last ~1000 blocks

    const toBlock = 'latest';

    // Query transfer events to this address
    const filter = {
      address: tokenConfig.address,
      topics: [
        ethers.utils.id('Transfer(address,address,uint256)'),
        null, // from (any address)
        ethers.utils.hexZeroPad(depositAddress as BytesLike, 32), // to (our wallet)
      ],
      fromBlock,
      toBlock,
    };

    const logs = await provider.getLogs(filter);

    this.logger.debug(
      `Found ${logs.length} transfer events for wallet ${depositAddress} on ${network}`,
    );

    for (const log of logs) {
      const parsedLog = iface.parseLog(log);
      const fromAddress = parsedLog.args.from;
      const amount = parsedLog.args.value;

      // Check if we already processed this transaction
      const existingDeposit = await this.prisma.deposit.findUnique({
        where: { txHash: log.transactionHash },
      });

      if (existingDeposit) {
        continue; // Already processed
      }

      // Convert amount to decimal
      const amountDecimal = new Decimal(
        ethers.utils.formatUnits(
          amount as BigNumber,
          tokenConfig.decimals as BigNumber,
        ),
      );

      // Create deposit record
      await this.createDeposit({
        walletId,
        userId,
        txHash: log.transactionHash,
        fromAddress,
        amount: amountDecimal,
        network,
        stablecoinType,
        blockNumber: BigInt(log.blockNumber),
      });

      this.logger.log(
        `New deposit detected: ${amountDecimal.toString()} ${stablecoinType} to wallet ${depositAddress} (tx: ${log.transactionHash})`,
      );
    }
  }

  private async createDeposit(data: {
    walletId: string;
    userId: string;
    txHash: string;
    fromAddress: string;
    amount: Decimal;
    network: NetworkType;
    stablecoinType: StablecoinType;
    blockNumber: bigint;
  }) {
    const requiredConfirms = this.requiredConfirmations[data.network];

    // Create deposit record
    const deposit = await this.prisma.deposit.create({
      data: {
        walletId: data.walletId,
        txHash: data.txHash,
        fromAddress: data.fromAddress,
        amount: data.amount,
        network: data.network,
        blockNumber: data.blockNumber,
        confirmations: 0,
        requiredConfirms,
        status: TransactionStatus.PENDING,
      },
    });

    // Create transaction record
    await this.prisma.transaction.create({
      data: {
        userId: data.userId,
        type: 'DEPOSIT',
        status: TransactionStatus.PENDING,
        stablecoinType: data.stablecoinType,
        network: data.network,
        amount: data.amount,
        fee: 0,
        txHash: data.txHash,
        fromAddress: data.fromAddress,
      },
    });

    // Check confirmations immediately
    await this.updateDepositConfirmations(deposit.id);
  }

  private async updatePendingDeposits() {
    // Get all pending deposits
    const pendingDeposits = await this.prisma.deposit.findMany({
      where: {
        status: TransactionStatus.PENDING,
      },
      include: {
        wallet: {
          include: {
            user: true,
          },
        },
      },
    });

    this.logger.debug(`Updating ${pendingDeposits.length} pending deposits`);

    for (const deposit of pendingDeposits) {
      try {
        await this.updateDepositConfirmations(deposit.id);
      } catch (error) {
        this.logger.error(
          `Error updating deposit ${deposit.id}: ${error.message}`,
        );
      }
    }
  }

  private async updateDepositConfirmations(depositId: string) {
    const deposit = await this.prisma.deposit.findUnique({
      where: { id: depositId },
      include: {
        wallet: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!deposit || deposit.status !== TransactionStatus.PENDING) {
      return;
    }

    const provider = this.blockchain.getProvider(deposit.network);
    const currentBlock = await provider.getBlockNumber();
    const confirmations = currentBlock - Number(deposit.blockNumber);

    // Update confirmations
    await this.prisma.deposit.update({
      where: { id: depositId },
      data: { confirmations },
    });

    // Check if confirmed
    if (confirmations >= deposit.requiredConfirms) {
      await this.confirmDeposit(deposit);
    }
  }

  private async confirmDeposit(deposit: any) {
    this.logger.log(
      `Confirming deposit ${deposit.id}: ${deposit.amount} ${deposit.wallet.stablecoinType}`,
    );

    const withinLimits = await this.checkDepositLimits(
      deposit.wallet.userId as string,
      deposit.amount as Decimal,
    );

    if (!withinLimits) {
      // Still confirm the deposit but flag it
      this.logger.warn(
        `Deposit ${deposit.id} exceeds limits - flagged for review`,
      );
    }

    // Update deposit status
    await this.prisma.deposit.update({
      where: { id: deposit.id },
      data: {
        status: TransactionStatus.COMPLETED,
        confirmedAt: new Date(),
      },
    });

    // Credit wallet
    await this.prisma.wallet.update({
      where: { id: deposit.walletId },
      data: {
        balance: {
          increment: deposit.amount,
        },
      },
    });

    // Update transaction
    await this.prisma.transaction.updateMany({
      where: {
        txHash: deposit.txHash,
        userId: deposit.wallet.userId,
      },
      data: {
        status: TransactionStatus.COMPLETED,
      },
    });

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        userId: deposit.wallet.userId,
        action: 'DEPOSIT_RECEIVED',
        entityType: 'deposit',
        entityId: deposit.id,
        metadata: {
          amount: deposit.amount.toString(),
          stablecoinType: deposit.wallet.stablecoinType,
          txHash: deposit.txHash,
        },
      },
    });

    // Send notification
    await this.sendDepositNotification(deposit);

    this.logger.log(
      `Deposit confirmed and credited: ${deposit.amount} ${deposit.wallet.stablecoinType} to user ${deposit.wallet.user.email}`,
    );
  }

  private async sendDepositNotification(deposit: any) {
    const user = deposit.wallet.user;
    const shouldNotify = await this.checkUserNotificationPreference(
      user.id as string,
    );
    if (!shouldNotify) {
      this.logger.debug(`User ${user.id} has disabled deposit notifications`);
      return;
    }
    const amount = deposit.amount.toString();
    const stablecoin = deposit.wallet.stablecoinType;
    const txHash = deposit.txHash;

    try {
      // Send email notification
      await this.emailService.sendDepositConfirmedEmail(
        user.email as string,
        user.id as string,
        amount as string,
        stablecoin as string,
        txHash as string,
        deposit.network as string,
      );

      // Create notification record
      await this.prisma.notification.create({
        data: {
          userId: user.id,
          type: 'DEPOSIT_CONFIRMED',
          channel: 'EMAIL',
          recipient: user.email,
          subject: 'Deposit Confirmed',
          message: `Your deposit of ${amount} ${stablecoin} has been confirmed.`,
          status: 'sent',
          sentAt: new Date(),
          metadata: {
            amount,
            stablecoin,
            txHash,
            network: deposit.network,
          },
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to send deposit notification: ${error.message}`,
      );
    }
  }

  // Manual trigger for testing
  async manualScan() {
    this.logger.log('Manual deposit scan triggered');
    await this.scanForNewDeposits();
    await this.updatePendingDeposits();
    return { success: true, message: 'Scan completed' };
  }

  async getDepositStatus(txHash: string) {
    const deposit = await this.prisma.deposit.findUnique({
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

    if (!deposit) {
      return null;
    }

    return {
      id: deposit.id,
      txHash: deposit.txHash,
      amount: deposit.amount.toString(),
      stablecoinType: deposit.wallet.stablecoinType,
      network: deposit.wallet.network,
      confirmations: deposit.confirmations,
      requiredConfirmations: deposit.requiredConfirms,
      status: deposit.status,
      createdAt: deposit.createdAt,
      confirmedAt: deposit.confirmedAt,
    };
  }

  async getMonitoringStats() {
    const [totalDeposits, pendingDeposits, completedToday] = await Promise.all([
      this.prisma.deposit.count(),
      this.prisma.deposit.count({
        where: { status: TransactionStatus.PENDING },
      }),
      this.prisma.deposit.count({
        where: {
          status: TransactionStatus.COMPLETED,
          confirmedAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
    ]);

    const totalVolume = await this.prisma.deposit.aggregate({
      where: { status: TransactionStatus.COMPLETED },
      _sum: { amount: true },
    });

    return {
      totalDeposits,
      pendingDeposits,
      completedToday,
      totalVolume: totalVolume._sum.amount?.toString() || '0',
    };
  }

  private async checkUserNotificationPreference(
    userId: string,
  ): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { metadata: true },
    });

    const metadata: any = user?.metadata || {};

    // Check if user disabled deposit notifications
    return metadata.notifications?.deposits !== false;
  }

  // DEPOSIT LIMITS & FRAUD DETECTION
  private async checkDepositLimits(
    userId: string,
    amount: Decimal,
  ): Promise<boolean> {
    // Get user's KYC status
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      this.logger.warn(`User ${userId} not found for deposit limit check.`);
      return false;
    }

    // Set limits based on KYC
    const dailyLimit =
      user.kycStatus === 'APPROVED'
        ? new Decimal(50000) // $50k for KYC approved
        : new Decimal(1000); // $1k for non-KYC

    // Check today's deposits
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayDeposits = await this.prisma.deposit.aggregate({
      where: {
        wallet: { userId },
        status: TransactionStatus.COMPLETED,
        confirmedAt: { gte: todayStart },
      },
      _sum: { amount: true },
    });

    const totalToday = new Decimal(
      todayDeposits._sum.amount?.toString() || '0',
    );
    const newTotal = totalToday.add(amount);

    if (newTotal.greaterThan(dailyLimit)) {
      // Flag for review
      await this.flagSuspiciousDeposit(userId, amount, 'Daily limit exceeded');
      return false;
    }

    return true;
  }

  private async flagSuspiciousDeposit(
    userId: string,
    amount: Decimal,
    reason: string,
  ) {
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'ADMIN_ACTION',
        entityType: 'deposit',
        metadata: {
          flag: 'SUSPICIOUS_DEPOSIT',
          amount: amount.toString(),
          reason,
        },
      },
    });

    // Send alert to admin
    this.logger.warn(
      `⚠️ Suspicious deposit flagged for user ${userId}: ${reason}`,
    );
  }

  // ============================================
  // SOLANA DEPOSIT MONITORING
  // ============================================

  private async checkSolanaWalletForDeposits(wallet: any) {
    const {
      network,
      stablecoinType,
      depositAddress,
      id: walletId,
      userId,
    } = wallet;

    // Get token config
    const tokenConfig = this.tokenAddresses[network]?.[stablecoinType];
    if (
      !tokenConfig ||
      tokenConfig.address === '0x0000000000000000000000000000000000000000'
    ) {
      return; // Token not available on Solana
    }

    try {
      const solanaService = this.blockchain.getSolanaService();

      if (!solanaService.isConfigured()) {
        this.logger.warn('Solana service not configured');
        return;
      }

      // Get last processed signature for this wallet
      const lastDeposit = await this.prisma.deposit.findFirst({
        where: { walletId },
        orderBy: { createdAt: 'desc' },
      });

      // Get recent signatures for this address
      const signatures = await solanaService.getSignaturesForAddress(
        depositAddress,
        lastDeposit?.txHash, // Start from last processed
        50, // Check last 50 transactions
      );

      this.logger.debug(
        `Found ${signatures.length} signatures for Solana wallet ${depositAddress}`,
      );

      for (const sig of signatures) {
        // Check if we already processed this transaction
        const existingDeposit = await this.prisma.deposit.findUnique({
          where: { txHash: sig.signature },
        });

        if (existingDeposit) {
          continue; // Already processed
        }

        // Parse SPL token transfer
        const transfer = await solanaService.parseTokenTransfer(sig.signature);

        if (!transfer) {
          continue; // Not a token transfer
        }

        // Check if transfer is to our wallet and correct token
        if (
          transfer.to !== depositAddress ||
          transfer.tokenMint !== tokenConfig.address
        ) {
          continue; // Not for us
        }

        // Convert amount (SPL tokens use different decimals)
        const amountDecimal = new Decimal(transfer.amount).div(
          Math.pow(10, tokenConfig.decimals),
        );

        // Get transaction details
        const transaction = await solanaService.getTransaction(sig.signature);

        if (!transaction) {
          continue;
        }

        // Create deposit record
        await this.createDeposit({
          walletId,
          userId,
          txHash: sig.signature,
          fromAddress: transfer.from,
          amount: amountDecimal,
          network: 'SOLANA',
          stablecoinType,
          blockNumber: BigInt(transaction.slot),
        });

        this.logger.log(
          `New Solana deposit detected: ${amountDecimal.toString()} ${stablecoinType} to wallet ${depositAddress} (sig: ${sig.signature})`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error checking Solana wallet ${depositAddress}: ${error.message}`,
      );
    }
  }

  // ============================================
  // TON DEPOSIT MONITORING
  // ============================================

  private async checkTonWalletForDeposits(wallet: any) {
    const {
      network,
      stablecoinType,
      depositAddress,
      id: walletId,
      userId,
    } = wallet;

    // Get token config
    const tokenConfig = this.tokenAddresses[network]?.[stablecoinType];
    if (
      !tokenConfig ||
      tokenConfig.address === '0x0000000000000000000000000000000000000000'
    ) {
      return; // Token not available on TON
    }

    try {
      const tonService = this.blockchain.getTonService();

      if (!tonService.isConfigured()) {
        this.logger.warn('TON service not configured');
        return;
      }

      // Get recent transactions for this address
      const transactions = await tonService.getTransactions(depositAddress, 50);

      this.logger.debug(
        `Found ${transactions.length} transactions for TON wallet ${depositAddress}`,
      );

      for (const tx of transactions) {
        // Check if we already processed this transaction
        const existingDeposit = await this.prisma.deposit.findUnique({
          where: { txHash: tx.hash },
        });

        if (existingDeposit) {
          continue; // Already processed
        }

        // For TON, we need to check if this is a jetton transfer
        // This requires parsing the transaction message
        // For now, check native TON transfers (simplified)

        if (!tx.to || tx.to !== depositAddress) {
          continue; // Not to our wallet
        }

        if (!tx.value || tx.value === '0') {
          continue; // No value transferred
        }

        // Convert nanotons to TON
        const amountDecimal = new Decimal(tx.value).div(1e9);

        // Get last processed block for this wallet
        const lastDeposit = await this.prisma.deposit.findFirst({
          where: { walletId },
          orderBy: { blockNumber: 'desc' },
        });

        // Skip if this transaction is older than last processed
        if (lastDeposit && tx.timestamp <= Number(lastDeposit.blockNumber)) {
          continue;
        }

        // Create deposit record
        await this.createDeposit({
          walletId,
          userId,
          txHash: tx.hash,
          fromAddress: tx.from || 'unknown',
          amount: amountDecimal,
          network: 'TON',
          stablecoinType,
          blockNumber: BigInt(tx.timestamp),
        });

        this.logger.log(
          `New TON deposit detected: ${amountDecimal.toString()} TON to wallet ${depositAddress} (tx: ${tx.hash})`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error checking TON wallet ${depositAddress}: ${error.message}`,
      );
    }
  }

  // ============================================
  // SUI DEPOSIT MONITORING
  // ============================================

  private async checkSuiWalletForDeposits(wallet: any) {
    const {
      network,
      stablecoinType,
      depositAddress,
      id: walletId,
      userId,
    } = wallet;

    // Get token config
    const tokenConfig = this.tokenAddresses[network]?.[stablecoinType];
    if (
      !tokenConfig ||
      tokenConfig.address === '0x0000000000000000000000000000000000000000'
    ) {
      return; // Token not available on SUI
    }

    try {
      const suiService = this.blockchain.getSuiService();

      if (!suiService.isConfigured()) {
        this.logger.warn('SUI service not configured');
        return;
      }

      // Get recent transactions (paginated)
      const txResult = await suiService.getTransactionsForAddress(
        depositAddress,
        null,
        50,
      );

      for (const txDigest of txResult.data) {
        // Check if already processed
        const existingDeposit = await this.prisma.deposit.findUnique({
          where: { txHash: txDigest },
        });

        if (existingDeposit) continue;

        // Parse coin transfer
        const transfer = await suiService.parseCoinTransfer(txDigest);
        if (!transfer) continue;

        // Check if transfer is to our deposit address and correct coin type
        if (
          transfer.to !== depositAddress ||
          transfer.coinType !== tokenConfig.address
        ) {
          continue;
        }

        // Get coin metadata for decimals
        const metadata = await suiService.getCoinMetadata(transfer.coinType);
        const decimals = metadata?.decimals || 9;

        // Convert amount to decimal
        const amountDecimal = new Decimal(transfer.amount).div(
          Math.pow(10, decimals),
        );

        // Get transaction details for timestamp
        const transaction = await suiService.getTransaction(txDigest);
        if (!transaction) continue;

        // Get checkpoint for block number
        const checkpoint = transaction.checkpoint || '0';

        // Create deposit record
        await this.createDeposit({
          walletId,
          userId,
          txHash: txDigest,
          fromAddress: transfer.from,
          amount: amountDecimal,
          network: 'SUI',
          stablecoinType,
          blockNumber: BigInt(checkpoint),
        });

        this.logger.log(
          `New SUI deposit detected: ${amountDecimal.toString()} ${stablecoinType} to wallet ${depositAddress} (digest: ${txDigest})`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error checking SUI wallet ${depositAddress}: ${error.message}`,
      );
    }
  }
}
