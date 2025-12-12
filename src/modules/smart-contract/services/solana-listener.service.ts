import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Connection,
  PublicKey,
  Commitment,
  VersionedTransactionResponse,
} from '@solana/web3.js';
import { Program, AnchorProvider, Idl, BN } from '@coral-xyz/anchor';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../../prisma/prisma.service';
import { SOLANA_PROGRAM_ADDRESSES } from '../constants/contract-addresses';

interface SolanaPaymentEvent {
  orderId: string;
  buyer: string;
  tokenMint: string;
  amount: string;
  platformFee: string;
  apiKeyOwner: string;
  commission: string;
  productId?: string;
  productCount?: number;
  timestamp: number;
  signature: string;
  slot: number;
}

@Injectable()
export class SolanaListenerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SolanaListenerService.name);
  private mainnetConnection: Connection;
  private devnetConnection: Connection;
  private mainnetProgram: Program<any>;
  private devnetProgram: Program<any>;
  private subscriptionIds: number[] = [];
  private isShuttingDown = false;
  private lastProcessedSlot: Map<string, number> = new Map();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing Solana event listeners...');
    await this.initializeConnections();
  }

  async onModuleDestroy() {
    this.logger.log('Shutting down Solana event listeners...');
    this.isShuttingDown = true;
    await this.stopAllListeners();
  }

  /**
   * Initialize Solana connections and programs
   */
  private async initializeConnections() {
    try {
      // Setup devnet
      const devnetRpcUrl =
        this.configService.get<string>('SOLANA_DEVNET_RPC_URL') ||
        'https://api.devnet.solana.com';
      this.devnetConnection = new Connection(devnetRpcUrl, 'confirmed');

      // Setup mainnet
      const mainnetRpcUrl =
        this.configService.get<string>('SOLANA_RPC_URL') ||
        'https://api.mainnet-beta.solana.com';
      this.mainnetConnection = new Connection(mainnetRpcUrl, 'confirmed');

      // Load program IDL (would need to be imported or fetched)
      // For now, we'll use transaction parsing instead of anchor events
      // const programId = new PublicKey(SOLANA_PROGRAM_ADDRESSES.mainnet.programId);

      // Start listening for program transactions
      await this.startDevnetListener();
      await this.startMainnetListener();

      this.logger.log('✅ Solana listeners initialized');
    } catch (error) {
      this.logger.error(
        `Failed to initialize Solana connections: ${error.message}`,
      );
    }
  }

  /**
   * Start devnet listener
   */
  private async startDevnetListener() {
    const programId = SOLANA_PROGRAM_ADDRESSES.devnet.programId;
    if (!programId || programId === '11111111111111111111111111111111' || programId.startsWith('9xMartPayment')) {
      this.logger.warn('Solana devnet program ID not configured, skipping');
      return;
    }

    try {
      const pubkey = new PublicKey(programId);

      // Subscribe to logs mentioning the program
      const subscriptionId = this.devnetConnection.onLogs(
        pubkey,
        async (logs, ctx) => {
          if (this.isShuttingDown) return;

          try {
            await this.processTransactionLogs(
              logs.signature,
              this.devnetConnection,
              'devnet',
            );
          } catch (error) {
            this.logger.error(
              `Error processing devnet transaction: ${error.message}`,
            );
          }
        },
        'confirmed',
      );

      this.subscriptionIds.push(subscriptionId);
      this.logger.log(`✅ Listening to Solana devnet program: ${programId}`);
    } catch (error) {
      this.logger.error(`Failed to start devnet listener: ${error.message}`);
    }
  }

  /**
   * Start mainnet listener
   */
  private async startMainnetListener() {
    const programId = SOLANA_PROGRAM_ADDRESSES.mainnet.programId;
    if (
      !programId ||
      programId === '9xMartPayment11111111111111111111111111111' ||
      programId.startsWith('9xMartPayment')
    ) {
      this.logger.warn('Solana mainnet program ID not configured, skipping');
      return;
    }

    try {
      const pubkey = new PublicKey(programId);

      const subscriptionId = this.mainnetConnection.onLogs(
        pubkey,
        async (logs, ctx) => {
          if (this.isShuttingDown) return;

          try {
            await this.processTransactionLogs(
              logs.signature,
              this.mainnetConnection,
              'mainnet',
            );
          } catch (error) {
            this.logger.error(
              `Error processing mainnet transaction: ${error.message}`,
            );
          }
        },
        'confirmed',
      );

      this.subscriptionIds.push(subscriptionId);
      this.logger.log(`✅ Listening to Solana mainnet program: ${programId}`);
    } catch (error) {
      this.logger.error(`Failed to start mainnet listener: ${error.message}`);
    }
  }

  /**
   * Process transaction logs to extract payment events
   */
  private async processTransactionLogs(
    signature: string,
    connection: Connection,
    network: 'mainnet' | 'devnet',
  ) {
    try {
      // Fetch transaction details
      const transaction = await connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });

      if (!transaction || !transaction.meta) {
        this.logger.warn(`Transaction ${signature} not found or has no meta`);
        return;
      }

      // Check if we already processed this slot
      const slotKey = `${network}-${transaction.slot}`;
      const lastSlot = this.lastProcessedSlot.get(slotKey) || 0;
      if (transaction.slot <= lastSlot) {
        return; // Already processed
      }
      this.lastProcessedSlot.set(slotKey, transaction.slot);

      // Parse logs to find PaymentProcessed or BatchPaymentProcessed events
      const logs = transaction.meta.logMessages || [];

      // Look for event signatures in logs
      // Anchor events are emitted as: "Program log: <event_name> <base64_encoded_data>"
      for (const log of logs) {
        if (
          log.includes('PaymentProcessed') ||
          log.includes('BatchPaymentProcessed')
        ) {
          await this.parseAndHandlePaymentEvent(
            transaction,
            network,
            signature,
          );
          break;
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to process transaction ${signature}: ${error.message}`,
      );
    }
  }

  /**
   * Parse transaction and extract payment event data
   */
  private async parseAndHandlePaymentEvent(
    transaction: VersionedTransactionResponse,
    network: 'mainnet' | 'devnet',
    signature: string,
  ) {
    try {
      if (!transaction.meta) {
        this.logger.warn('Transaction has no meta, skipping');
        return;
      }

      // Extract accounts from transaction
      const accounts = transaction.transaction.message.staticAccountKeys || [];
      if (accounts.length === 0) {
        this.logger.warn('Transaction has no account keys');
        return;
      }

      // Convert account keys to PublicKeys if needed
      const accountKeys = accounts.map((key) =>
        typeof key === 'string' ? new PublicKey(key) : key,
      );

      // The transaction structure for Solana payment:
      // accounts[0] = buyer (signer)
      // accounts[1] = config PDA
      // accounts[2] = order_record PDA
      // accounts[3] = buyer_token_account
      // accounts[4] = hot_wallet_token_account
      // accounts[5] = token_program
      // accounts[6] = system_program

      if (accountKeys.length < 7) {
        this.logger.warn('Transaction has insufficient accounts');
        return;
      }

      const buyer = accountKeys[0].toString();

      // Try to extract order ID from order_record PDA
      // The order_record PDA is derived from seeds: ["order", order_id]
      // We would need to parse the account data to get the order_id

      // For now, log that we detected a payment
      this.logger.log(`💰 Solana payment detected on ${network}: ${signature}`);

      // Parse token transfer amounts from inner instructions
      const preBalances = transaction.meta?.preTokenBalances || [];
      const postBalances = transaction.meta?.postTokenBalances || [];

      let transferAmount = '0';
      for (let i = 0; i < postBalances.length; i++) {
        const pre = preBalances.find(
          (b) => b.accountIndex === postBalances[i].accountIndex,
        );
        if (pre && pre.uiTokenAmount && postBalances[i].uiTokenAmount) {
          const preAmount = pre.uiTokenAmount.uiAmount;
          const postAmount = postBalances[i].uiTokenAmount.uiAmount;

          if (preAmount !== null && postAmount !== null) {
            const diff = postAmount - preAmount;
            if (diff > 0) {
              transferAmount = postBalances[i].uiTokenAmount.amount;
              break;
            }
          }
        }
      }

      // Get token mint address
      const tokenMint = postBalances[0]?.mint || '';

      // Create event object
      const event: SolanaPaymentEvent = {
        orderId: signature.substring(0, 32), // Temporary: use signature as order ID
        buyer,
        tokenMint,
        amount: transferAmount,
        platformFee: '0', // Would need to parse from account data
        apiKeyOwner: '', // Would need to parse from account data
        commission: '0', // Would need to parse from account data
        timestamp: transaction.blockTime || Math.floor(Date.now() / 1000),
        signature,
        slot: transaction.slot,
      };

      // Handle the payment event
      await this.handlePaymentEvent(event, network);
    } catch (error) {
      this.logger.error(
        `Failed to parse payment event: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Handle payment event from Solana
   */
  private async handlePaymentEvent(
    event: SolanaPaymentEvent,
    network: 'mainnet' | 'devnet',
  ) {
    const {
      orderId,
      buyer,
      tokenMint,
      amount,
      platformFee,
      apiKeyOwner,
      commission,
      timestamp,
      signature,
      slot,
    } = event;

    try {
      // Check if this transaction was already processed
      const existingOrder = await this.prisma.order.findFirst({
        where: { transactionHash: signature },
      });

      if (existingOrder) {
        this.logger.debug(
          `Order with signature ${signature} already processed, skipping`,
        );
        return;
      }

      // Find the user by wallet address (buyer)
      const wallet = await this.prisma.wallet.findFirst({
        where: {
          depositAddress: buyer.toLowerCase(),
          network: 'SOLANA' as any,
        },
        include: {
          user: true,
        },
      });

      if (!wallet) {
        this.logger.warn(`No wallet found for Solana address ${buyer}`);
        await this.createPendingSolanaOrder(event, network);
        return;
      }

      // Check if order exists by orderId
      const orderById = await this.prisma.order.findUnique({
        where: { id: orderId },
      });

      if (orderById) {
        // Update existing order with blockchain confirmation
        await this.prisma.order.update({
          where: { id: orderId },
          data: {
            status: 'PAID' as any,
            transactionHash: signature,
            blockNumber: slot.toString(),
            network: 'SOLANA' as any,
            paymentConfirmedAt: new Date(timestamp * 1000),
            updatedAt: new Date(),
          },
        });

        this.logger.log(`✅ Solana order ${orderId} confirmed on blockchain`);
      } else {
        // Direct blockchain payment
        await this.createSolanaOrderFromBlockchain(
          event,
          wallet.userId,
          network,
        );
      }

      // Track commission if applicable
      if (apiKeyOwner && commission !== '0') {
        await this.trackSolanaCommission(
          orderId,
          apiKeyOwner,
          commission,
          tokenMint,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to process Solana payment event ${signature}: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Create pending order for unknown buyer
   */
  private async createPendingSolanaOrder(
    event: SolanaPaymentEvent,
    network: 'mainnet' | 'devnet',
  ) {
    try {
      // Generate a temporary order number
      const timestamp = Date.now();
      const orderNumber = `SOLANA-PENDING-${timestamp}-${Math.floor(
        Math.random() * 10000,
      )
        .toString()
        .padStart(4, '0')}`;

      await this.prisma.order.create({
        data: {
          id: event.signature.substring(0, 32),
          userId: 'PENDING', // Temporary placeholder
          orderNumber,
          stablecoinType: 'USDC' as any, // Default stablecoin
          status: 'PENDING' as any,
          transactionHash: event.signature,
          blockNumber: event.slot.toString(),
          network: 'SOLANA' as any,
          totalAmount: new Decimal(event.amount).div(1_000_000), // Assume 6 decimals
          subtotal: new Decimal(event.amount).div(1_000_000),
          total: new Decimal(event.amount).div(1_000_000),
          buyerAddress: event.buyer.toLowerCase(),
          createdAt: new Date(event.timestamp * 1000),
          updatedAt: new Date(),
        },
      });

      this.logger.log(
        `Created pending Solana order ${event.signature} for manual review`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to create pending Solana order: ${error.message}`,
      );
    }
  }

  /**
   * Create order from direct blockchain payment
   */
  private async createSolanaOrderFromBlockchain(
    event: SolanaPaymentEvent,
    userId: string,
    network: 'mainnet' | 'devnet',
  ) {
    try {
      // Generate order number
      const timestamp = Date.now();
      const orderNumber = `SOLANA-BC-${timestamp}-${Math.floor(
        Math.random() * 10000,
      )
        .toString()
        .padStart(4, '0')}`;

      await this.prisma.order.create({
        data: {
          id: event.orderId,
          userId,
          orderNumber,
          stablecoinType: 'USDC' as any, // Default stablecoin
          status: 'PAID' as any,
          transactionHash: event.signature,
          blockNumber: event.slot.toString(),
          network: 'SOLANA' as any,
          totalAmount: new Decimal(event.amount).div(1_000_000), // Assume 6 decimals
          subtotal: new Decimal(event.amount).div(1_000_000),
          total: new Decimal(event.amount).div(1_000_000),
          platformFee: new Decimal(event.platformFee).div(1_000_000),
          paymentConfirmedAt: new Date(event.timestamp * 1000),
          createdAt: new Date(event.timestamp * 1000),
          updatedAt: new Date(),
        },
      });

      this.logger.log(
        `✅ Created Solana order ${event.orderId} from blockchain event`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to create Solana order from blockchain event: ${error.message}`,
      );
    }
  }

  /**
   * Track commission for Solana payment
   */
  private async trackSolanaCommission(
    orderId: string,
    apiKeyOwnerAddress: string,
    commission: string,
    tokenMint: string,
  ) {
    try {
      this.logger.log(
        `Solana commission earned: ${parseFloat(commission) / 1_000_000} tokens for ${apiKeyOwnerAddress}`,
      );

      // TODO: Store commission in database
      // await this.prisma.commission.create({
      //   data: {
      //     orderId,
      //     amount: parseFloat(commission) / 1_000_000,
      //     network: 'SOLANA',
      //     tokenMint,
      //     recipientAddress: apiKeyOwnerAddress,
      //   },
      // });
    } catch (error) {
      this.logger.error(`Failed to track Solana commission: ${error.message}`);
    }
  }

  /**
   * Stop all listeners
   */
  private async stopAllListeners() {
    for (const subscriptionId of this.subscriptionIds) {
      try {
        await this.devnetConnection.removeOnLogsListener(subscriptionId);
      } catch (error) {
        // May fail if connection already closed
      }
      try {
        await this.mainnetConnection.removeOnLogsListener(subscriptionId);
      } catch (error) {
        // May fail if connection already closed
      }
    }
    this.subscriptionIds = [];
    this.logger.log('Stopped all Solana listeners');
  }

  /**
   * Get connection status
   */
  async getConnectionStatus(): Promise<any> {
    try {
      const [devnetVersion, mainnetVersion] = await Promise.all([
        this.devnetConnection.getVersion(),
        this.mainnetConnection.getVersion(),
      ]);

      return {
        devnet: {
          connected: true,
          version: devnetVersion,
        },
        mainnet: {
          connected: true,
          version: mainnetVersion,
        },
      };
    } catch (error) {
      return {
        devnet: { connected: false, error: error.message },
        mainnet: { connected: false, error: error.message },
      };
    }
  }

  /**
   * Manually fetch and process recent transactions (for testing or catching up)
   */
  async fetchRecentTransactions(network: 'mainnet' | 'devnet', limit = 10) {
    const connection =
      network === 'mainnet' ? this.mainnetConnection : this.devnetConnection;
    const programId =
      network === 'mainnet'
        ? SOLANA_PROGRAM_ADDRESSES.mainnet.programId
        : SOLANA_PROGRAM_ADDRESSES.devnet.programId;

    try {
      const pubkey = new PublicKey(programId);
      const signatures = await connection.getSignaturesForAddress(pubkey, {
        limit,
      });

      this.logger.log(
        `Found ${signatures.length} recent transactions on ${network}`,
      );

      for (const sigInfo of signatures) {
        await this.processTransactionLogs(
          sigInfo.signature,
          connection,
          network,
        );
      }

      return signatures.length;
    } catch (error) {
      this.logger.error(
        `Failed to fetch recent transactions: ${error.message}`,
      );
      return 0;
    }
  }
}
