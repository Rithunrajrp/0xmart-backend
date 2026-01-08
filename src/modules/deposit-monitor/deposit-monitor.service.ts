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

  // ERC20 token addresses per network (TESTNET for development)
  private readonly tokenAddresses: Record<
    NetworkType,
    Record<StablecoinType, TokenConfig>
  > = {
    ETHEREUM: {
      USDT: {
        address: '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06', // Sepolia USDT
        decimals: 6,
      },
      USDC: {
        address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // Sepolia USDC
        decimals: 6,
      },
      DAI: {
        address: '0x68194a729C2450ad26072b3D33ADaCbcef39D574', // Sepolia DAI
        decimals: 18,
      },
      BUSD: {
        address: '0x0000000000000000000000000000000000000000',
        decimals: 18,
      }, // Not available on testnet
    },
    POLYGON: {
      USDT: {
        address: '0xfe4F5145f6e09952a5ba9e956ED0C25e3Fa4c7F1', // Amoy USDT
        decimals: 6,
      },
      USDC: {
        address: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582', // Amoy USDC (Circle official)
        decimals: 6,
      },
      DAI: {
        address: '0x001B3B4d0F3714Ca98ba10F6042DaEbF0B1B7b6F', // Amoy DAI
        decimals: 18,
      },
      BUSD: {
        address: '0x0000000000000000000000000000000000000000',
        decimals: 18,
      }, // Not available on testnet
    },
    BSC: {
      USDT: {
        address: '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd', // BSC Testnet USDT
        decimals: 18,
      },
      USDC: {
        address: '0x64544969ed7EBf5f083679233325356EbE738930', // BSC Testnet USDC
        decimals: 18,
      },
      DAI: {
        address: '0x0000000000000000000000000000000000000000',
        decimals: 18,
      }, // Not available on testnet
      BUSD: {
        address: '0x0000000000000000000000000000000000000000',
        decimals: 18,
      }, // Not available on testnet
    },
    ARBITRUM: {
      USDT: {
        address: '0xfd064a18f3bf249cf1f87fc203e90d8f650f2d63', // Arbitrum Sepolia USDT
        decimals: 6,
      },
      USDC: {
        address: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d', // Arbitrum Sepolia USDC
        decimals: 6,
      },
      DAI: {
        address: '0x0000000000000000000000000000000000000000',
        decimals: 18,
      }, // Not available on testnet
      BUSD: {
        address: '0x0000000000000000000000000000000000000000',
        decimals: 18,
      }, // Not available on testnet
    },
    OPTIMISM: {
      USDT: {
        address: '0x7E07E15D2a87A24492740D16f5bdF58c16db0c4E', // Optimism Sepolia USDT
        decimals: 6,
      },
      USDC: {
        address: '0x5fd84259d66Cd46123540766Be93DFE6D43130D7', // Optimism Sepolia USDC
        decimals: 6,
      },
      DAI: {
        address: '0x0000000000000000000000000000000000000000',
        decimals: 18,
      }, // Not available on testnet
      BUSD: {
        address: '0x0000000000000000000000000000000000000000',
        decimals: 18,
      }, // Not available on testnet
    },
    AVALANCHE: {
      USDT: {
        address: '0x134Dc38AE8C853D1aa465dC00a76a52B2a7F29E5', // Fuji testnet USDT
        decimals: 6,
      },
      USDC: {
        address: '0x5425890298aed601595a70AB815c96711a31Bc65', // Fuji testnet USDC
        decimals: 6,
      },
      DAI: {
        address: '0x51BC2DfB9D12d9dB50C855A5330fBA0faF761D15', // Fuji testnet DAI
        decimals: 18,
      },
      BUSD: {
        address: '0x0000000000000000000000000000000000000000',
        decimals: 18,
      }, // Not available on testnet
    },
    BASE: {
      USDT: {
        address: '0x0000000000000000000000000000000000000000',
        decimals: 6,
      }, // Not available on testnet
      USDC: {
        address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Base Sepolia USDC
        decimals: 6,
      },
      DAI: {
        address: '0x0000000000000000000000000000000000000000',
        decimals: 18,
      }, // Not available on testnet
      BUSD: {
        address: '0x0000000000000000000000000000000000000000',
        decimals: 18,
      }, // Not available on testnet
    },
    SUI: {
      USDT: {
        address: '0xf7152c05330a500cc732c2fedac336ab2dfc6df1edadfa966c7b57fe53c2c916::usdt::USDT',
        decimals: 6,
      }, // Sui Testnet USDT
      USDC: {
        address: '0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC',
        decimals: 6,
      }, // Sui Testnet USDC (Circle official)
      DAI: {
        address: '0x0000000000000000000000000000000000000000',
        decimals: 18,
      }, // DAI not available on Sui testnet
      BUSD: {
        address: '0x0000000000000000000000000000000000000000',
        decimals: 18,
      }, // BUSD not available on Sui testnet
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

    const currentBlock = await provider.getBlockNumber();
    const fromBlock = lastDeposit?.blockNumber
      ? Number(lastDeposit.blockNumber) + 1
      : currentBlock - 1000; // Last ~1000 blocks

    // Scan in chunks to avoid RPC limits (max 2048 blocks per request)
    const CHUNK_SIZE = 2000;
    const allLogs: ethers.providers.Log[] = [];

    let startBlock = fromBlock;
    while (startBlock <= currentBlock) {
      const endBlock = Math.min(startBlock + CHUNK_SIZE - 1, currentBlock);

      // Query transfer events to this address
      // Normalize address to lowercase for event filtering
      const normalizedAddress = depositAddress.toLowerCase();
      const filter = {
        address: tokenConfig.address,
        topics: [
          ethers.utils.id('Transfer(address,address,uint256)'),
          null, // from (any address)
          ethers.utils.hexZeroPad(normalizedAddress as BytesLike, 32), // to (our wallet)
        ],
        fromBlock: startBlock,
        toBlock: endBlock,
      };

      try {
        const logs = await provider.getLogs(filter);
        allLogs.push(...logs);
      } catch (error) {
        this.logger.error(
          `Error fetching logs for blocks ${startBlock}-${endBlock}: ${error.message}`,
        );
      }

      startBlock = endBlock + 1;
    }

    const logs = allLogs;

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

  // Scan a specific wallet for deposits
  async scanSingleWallet(walletId: string) {
    this.logger.log(`Manual scan triggered for wallet ${walletId}`);

    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
      select: {
        id: true,
        userId: true,
        depositAddress: true,
        stablecoinType: true,
        network: true,
        balance: true,
      },
    });

    if (!wallet) {
      throw new Error('Wallet not found');
    }

    const balanceBefore = wallet.balance;

    // Check for new deposits
    await this.checkWalletForDeposits(wallet);

    // Check pending deposits for this wallet
    const pendingDeposits = await this.prisma.deposit.findMany({
      where: {
        walletId,
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

    for (const deposit of pendingDeposits) {
      try {
        await this.updateDepositConfirmations(deposit.id);
      } catch (error) {
        this.logger.error(
          `Error updating deposit ${deposit.id}: ${error.message}`,
        );
      }
    }

    // Get updated wallet balance
    const updatedWallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
    });

    if (!updatedWallet) {
      throw new Error('Wallet not found after scan');
    }

    const balanceAfter = updatedWallet.balance;
    const hasNewDeposits = !balanceBefore.equals(balanceAfter);

    // Count new deposits found
    const newDepositsCount = await this.prisma.deposit.count({
      where: {
        walletId,
        createdAt: {
          gte: new Date(Date.now() - 60000), // Last minute
        },
      },
    });

    return {
      success: true,
      hasNewDeposits,
      newDepositsCount,
      balanceBefore: balanceBefore.toString(),
      balanceAfter: balanceAfter.toString(),
      message: hasNewDeposits
        ? `Found ${newDepositsCount} new deposit(s)`
        : 'No new deposits found',
    };
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

        // Skip if transaction is not to our wallet
        if (!tx.to || tx.to !== depositAddress) {
          continue;
        }

        // Try to parse as jetton transfer first (for USDT/USDC)
        const jettonTransfer = await tonService.parseJettonTransfer(
          tx.hash,
          depositAddress,
        );

        if (jettonTransfer) {
          // This is a jetton transfer (USDT/USDC/etc)
          // Convert amount based on token decimals
          const amountDecimal = new Decimal(jettonTransfer.amount).div(
            Math.pow(10, tokenConfig.decimals),
          );

          // Create deposit record
          await this.createDeposit({
            walletId,
            userId,
            txHash: tx.hash,
            fromAddress: jettonTransfer.from,
            amount: amountDecimal,
            network: 'TON',
            stablecoinType,
            blockNumber: BigInt(tx.timestamp),
          });

          this.logger.log(
            `New TON jetton deposit detected: ${amountDecimal.toString()} ${stablecoinType} to wallet ${depositAddress} (tx: ${tx.hash})`,
          );
          continue;
        }

        // Fallback: Check native TON transfers
        // (Only if token type is TON native coin, not USDT/USDC)
        if (tx.value && tx.value !== '0') {
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

          // Create deposit record for native TON
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
