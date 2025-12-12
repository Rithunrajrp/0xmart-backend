import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../../prisma/prisma.service';
import {
  NetworkType,
  getContractAddress,
  getRpcUrl,
  isEvmNetwork,
} from '../constants/contract-addresses';

/**
 * OxMartPayment contract ABI - only events and view functions we need
 */
const PAYMENT_CONTRACT_ABI = [
  // Events
  'event PaymentReceived(bytes32 indexed orderId, address indexed buyer, address indexed tokenAddress, uint256 amount, uint256 platformFee, address apiKeyOwner, uint256 commission, string productId, uint256 timestamp)',
  'event BatchPaymentReceived(bytes32 indexed orderId, address indexed buyer, address indexed tokenAddress, uint256 totalAmount, uint256 platformFee, address apiKeyOwner, uint256 commission, uint256 productCount, uint256 timestamp)',
  // View functions
  'function hotWallet() view returns (address)',
  'function platformFeeBps() view returns (uint16)',
  'function paused() view returns (bool)',
];

interface PaymentEvent {
  orderId: string;
  buyer: string;
  tokenAddress: string;
  amount: string;
  platformFee: string;
  apiKeyOwner: string;
  commission: string;
  productId?: string;
  productCount?: number;
  timestamp: number;
  txHash: string;
  blockNumber: number;
  network: NetworkType;
}

@Injectable()
export class EvmListenerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EvmListenerService.name);
  private providers: Map<NetworkType, ethers.providers.JsonRpcProvider> =
    new Map();
  private contracts: Map<NetworkType, ethers.Contract> = new Map();
  private listeners: Map<NetworkType, any[]> = new Map();
  private reconnectAttempts: Map<NetworkType, number> = new Map();
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000; // 5 seconds

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing EVM event listeners...');
    await this.initializeListeners();
  }

  async onModuleDestroy() {
    this.logger.log('Shutting down EVM event listeners...');
    await this.stopAllListeners();
  }

  /**
   * Initialize listeners for all EVM networks
   */
  private async initializeListeners() {
    const networks = Object.values(NetworkType).filter(isEvmNetwork);

    for (const network of networks) {
      try {
        await this.setupNetworkListener(network);
      } catch (error) {
        this.logger.error(
          `Failed to initialize listener for ${network}: ${error.message}`,
        );
      }
    }
  }

  /**
   * Setup listener for a specific network
   */
  private async setupNetworkListener(network: NetworkType) {
    const rpcUrl = getRpcUrl(network);
    const contractAddress = getContractAddress(network)?.payment;

    if (!rpcUrl) {
      this.logger.warn(`No RPC URL configured for ${network}, skipping`);
      return;
    }

    if (
      !contractAddress ||
      contractAddress === '0x0000000000000000000000000000000000000000'
    ) {
      this.logger.warn(
        `No contract address configured for ${network}, skipping`,
      );
      return;
    }

    try {
      // Create provider
      const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
      await provider.getNetwork(); // Verify connection
      this.providers.set(network, provider);

      // Create contract instance
      const contract = new ethers.Contract(
        contractAddress,
        PAYMENT_CONTRACT_ABI,
        provider,
      );
      this.contracts.set(network, contract);

      // Setup event listeners
      const paymentListener = contract.on(
        'PaymentReceived',
        async (
          orderId,
          buyer,
          tokenAddress,
          amount,
          platformFee,
          apiKeyOwner,
          commission,
          productId,
          timestamp,
          event,
        ) => {
          await this.handlePaymentEvent({
            orderId: orderId,
            buyer,
            tokenAddress,
            amount: amount.toString(),
            platformFee: platformFee.toString(),
            apiKeyOwner,
            commission: commission.toString(),
            productId,
            timestamp: timestamp.toNumber(),
            txHash: event.transactionHash,
            blockNumber: event.blockNumber,
            network,
          });
        },
      );

      const batchPaymentListener = contract.on(
        'BatchPaymentReceived',
        async (
          orderId,
          buyer,
          tokenAddress,
          totalAmount,
          platformFee,
          apiKeyOwner,
          commission,
          productCount,
          timestamp,
          event,
        ) => {
          await this.handlePaymentEvent({
            orderId: orderId,
            buyer,
            tokenAddress,
            amount: totalAmount.toString(),
            platformFee: platformFee.toString(),
            apiKeyOwner,
            commission: commission.toString(),
            productCount: productCount.toNumber(),
            timestamp: timestamp.toNumber(),
            txHash: event.transactionHash,
            blockNumber: event.blockNumber,
            network,
          });
        },
      );

      // Store listeners for cleanup
      this.listeners.set(network, [paymentListener, batchPaymentListener]);

      // Setup provider error handling
      provider.on('error', (error) => {
        this.logger.error(`Provider error for ${network}: ${error.message}`);
        this.handleProviderError(network);
      });

      // Setup websocket reconnection if applicable
      if (rpcUrl.startsWith('ws://') || rpcUrl.startsWith('wss://')) {
        provider.on('disconnect', () => {
          this.logger.warn(
            `Disconnected from ${network}, attempting reconnect...`,
          );
          this.handleProviderError(network);
        });
      }

      this.reconnectAttempts.set(network, 0);
      this.logger.log(`✅ Listening to ${network} at ${contractAddress}`);
    } catch (error) {
      this.logger.error(
        `Failed to setup listener for ${network}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Handle payment event from smart contract
   */
  private async handlePaymentEvent(event: PaymentEvent) {
    const {
      orderId,
      buyer,
      tokenAddress,
      amount,
      platformFee,
      apiKeyOwner,
      commission,
      productId,
      productCount,
      timestamp,
      txHash,
      blockNumber,
      network,
    } = event;

    this.logger.log(
      `💰 Payment detected on ${network}: ${orderId} - ${ethers.utils.formatUnits(amount, 6)} tokens`,
    );

    try {
      // Check if this transaction was already processed
      const existingOrder = await this.prisma.order.findUnique({
        where: { id: orderId },
      });

      if (existingOrder && existingOrder.transactionHash === txHash) {
        this.logger.debug(`Order ${orderId} already processed, skipping`);
        return;
      }

      // Find the user by wallet address (buyer)
      const wallet = await this.prisma.wallet.findFirst({
        where: {
          depositAddress: buyer.toLowerCase(),
          network: network.toUpperCase() as any,
        },
        include: {
          user: true,
        },
      });

      if (!wallet) {
        this.logger.warn(`No wallet found for address ${buyer} on ${network}`);
        // Store as pending for manual review
        await this.createPendingOrder(event);
        return;
      }

      // Check if order exists but wasn't confirmed
      if (existingOrder) {
        // Update existing order with blockchain confirmation
        await this.prisma.order.update({
          where: { id: orderId },
          data: {
            status: 'PAID' as any,
            transactionHash: txHash,
            blockNumber: blockNumber.toString(),
            network: network.toUpperCase() as any,
            paymentConfirmedAt: new Date(timestamp * 1000),
            updatedAt: new Date(),
          },
        });

        this.logger.log(`✅ Order ${orderId} confirmed on blockchain`);
      } else {
        // This is a direct smart contract payment (not initiated via API)
        this.logger.warn(
          `Received payment for unknown order ${orderId}, creating order record`,
        );
        await this.createOrderFromBlockchainEvent(event, wallet.userId);
      }

      // Track commission if applicable
      if (apiKeyOwner !== ethers.constants.AddressZero && commission !== '0') {
        await this.trackCommission(
          orderId,
          apiKeyOwner,
          commission,
          tokenAddress,
          network,
        );
      }

      // Send webhook notification if this order has a webhook configured
      // This will be implemented in the webhooks module
      // await this.webhooksService.notifyPaymentConfirmed(orderId);
    } catch (error) {
      this.logger.error(
        `Failed to process payment event ${orderId}: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Create pending order for unknown buyer
   */
  private async createPendingOrder(event: PaymentEvent) {
    try {
      // Generate a temporary order number
      const timestamp = Date.now();
      const orderNumber = `PENDING-${timestamp}-${Math.floor(
        Math.random() * 10000,
      )
        .toString()
        .padStart(4, '0')}`;

      await this.prisma.order.create({
        data: {
          id: event.orderId,
          userId: 'PENDING', // Temporary placeholder
          orderNumber,
          stablecoinType: 'USDC' as any, // Default stablecoin
          status: 'PENDING' as any,
          transactionHash: event.txHash,
          blockNumber: event.blockNumber.toString(),
          network: event.network.toUpperCase() as any,
          totalAmount: new Decimal(ethers.utils.formatUnits(event.amount, 6)),
          subtotal: new Decimal(ethers.utils.formatUnits(event.amount, 6)),
          total: new Decimal(ethers.utils.formatUnits(event.amount, 6)),
          buyerAddress: event.buyer.toLowerCase(),
          createdAt: new Date(event.timestamp * 1000),
          updatedAt: new Date(),
        },
      });

      this.logger.log(
        `Created pending order ${event.orderId} for manual review`,
      );
    } catch (error) {
      this.logger.error(`Failed to create pending order: ${error.message}`);
    }
  }

  /**
   * Create order from direct blockchain payment
   */
  private async createOrderFromBlockchainEvent(
    event: PaymentEvent,
    userId: string,
  ) {
    try {
      // Generate order number
      const timestamp = Date.now();
      const orderNumber = `BC-${timestamp}-${Math.floor(Math.random() * 10000)
        .toString()
        .padStart(4, '0')}`;

      // For direct blockchain payments, we may not have product details
      // Create a generic order that can be fulfilled manually
      await this.prisma.order.create({
        data: {
          id: event.orderId,
          userId,
          orderNumber,
          stablecoinType: 'USDC' as any, // Default stablecoin
          status: 'PAID' as any,
          transactionHash: event.txHash,
          blockNumber: event.blockNumber.toString(),
          network: event.network.toUpperCase() as any,
          totalAmount: new Decimal(ethers.utils.formatUnits(event.amount, 6)),
          subtotal: new Decimal(ethers.utils.formatUnits(event.amount, 6)),
          total: new Decimal(ethers.utils.formatUnits(event.amount, 6)),
          platformFee: new Decimal(
            ethers.utils.formatUnits(event.platformFee, 6),
          ),
          paymentConfirmedAt: new Date(event.timestamp * 1000),
          createdAt: new Date(event.timestamp * 1000),
          updatedAt: new Date(),
        },
      });

      this.logger.log(
        `✅ Created order ${event.orderId} from blockchain event`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to create order from blockchain event: ${error.message}`,
      );
    }
  }

  /**
   * Track commission for API key owner
   */
  private async trackCommission(
    orderId: string,
    apiKeyOwnerAddress: string,
    commission: string,
    tokenAddress: string,
    network: NetworkType,
  ) {
    try {
      // Find API key by owner address (this would need to be stored in ApiKey model)
      // For now, log the commission
      this.logger.log(
        `Commission earned: ${ethers.utils.formatUnits(commission, 6)} tokens for ${apiKeyOwnerAddress}`,
      );

      // TODO: Store commission in database
      // await this.prisma.commission.create({
      //   data: {
      //     orderId,
      //     amount: parseFloat(ethers.utils.formatUnits(commission, 6)),
      //     network: network.toUpperCase(),
      //     tokenAddress,
      //     recipientAddress: apiKeyOwnerAddress,
      //   },
      // });
    } catch (error) {
      this.logger.error(`Failed to track commission: ${error.message}`);
    }
  }

  /**
   * Handle provider errors and attempt reconnection
   */
  private async handleProviderError(network: NetworkType) {
    const attempts = this.reconnectAttempts.get(network) || 0;

    if (attempts >= this.maxReconnectAttempts) {
      this.logger.error(
        `Max reconnection attempts reached for ${network}, giving up`,
      );
      return;
    }

    this.reconnectAttempts.set(network, attempts + 1);

    // Remove old listeners
    await this.stopNetworkListener(network);

    // Wait before reconnecting
    await new Promise((resolve) => setTimeout(resolve, this.reconnectDelay));

    // Attempt reconnection
    try {
      this.logger.log(
        `Reconnecting to ${network} (attempt ${attempts + 1})...`,
      );
      await this.setupNetworkListener(network);
      this.logger.log(`✅ Reconnected to ${network}`);
      this.reconnectAttempts.set(network, 0);
    } catch (error) {
      this.logger.error(`Reconnection failed for ${network}: ${error.message}`);
      // Will retry on next error
    }
  }

  /**
   * Stop listener for a specific network
   */
  private async stopNetworkListener(network: NetworkType) {
    const contract = this.contracts.get(network);
    if (contract) {
      contract.removeAllListeners();
      this.contracts.delete(network);
    }

    const provider = this.providers.get(network);
    if (provider) {
      provider.removeAllListeners();
      this.providers.delete(network);
    }

    this.listeners.delete(network);
    this.logger.log(`Stopped listener for ${network}`);
  }

  /**
   * Stop all listeners
   */
  private async stopAllListeners() {
    const networks = Array.from(this.contracts.keys());
    for (const network of networks) {
      await this.stopNetworkListener(network);
    }
  }

  /**
   * Get contract status for a network
   */
  async getContractStatus(network: NetworkType): Promise<any> {
    const contract = this.contracts.get(network);
    if (!contract) {
      return { connected: false };
    }

    try {
      const [hotWallet, platformFeeBps, paused] = await Promise.all([
        contract.hotWallet(),
        contract.platformFeeBps(),
        contract.paused(),
      ]);

      return {
        connected: true,
        hotWallet,
        platformFeeBps: platformFeeBps.toNumber(),
        paused,
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message,
      };
    }
  }

  /**
   * Get all contract statuses
   */
  async getAllContractStatuses(): Promise<Record<string, any>> {
    const statuses: Record<string, any> = {};

    for (const network of this.contracts.keys()) {
      statuses[network] = await this.getContractStatus(network);
    }

    return statuses;
  }
}
