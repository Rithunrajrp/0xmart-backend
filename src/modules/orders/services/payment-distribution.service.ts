import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../prisma/prisma.service';
import { BlockchainService } from '../../wallets/services/blockchain.service';
import {
  NetworkType,
  StablecoinType,
  SellerPayoutStatus,
  Order,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

interface PaymentDistributionResult {
  merchantTxHash: string;
  platformTxHash: string;
  merchantAmount: Decimal;
  platformFeeAmount: Decimal;
  sellerPayoutId: string;
}

@Injectable()
export class PaymentDistributionService {
  private readonly logger = new Logger(PaymentDistributionService.name);

  // Platform fee percentage (20% markup over merchant's base price)
  private readonly PLATFORM_FEE_PERCENTAGE = 0.20;

  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchainService: BlockchainService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Distributes payment from an order to merchant and platform owner
   */
  async distributeOrderPayment(
    order: Order & { items: any[] },
  ): Promise<PaymentDistributionResult> {
    this.logger.log(`Starting payment distribution for order: ${order.orderNumber}`);

    try {
      // 1. Calculate payment splits
      const total = new Decimal(order.total.toString());
      const platformFeeAmount = total.mul(this.PLATFORM_FEE_PERCENTAGE);
      const merchantAmount = total.sub(platformFeeAmount);

      this.logger.log(
        `Payment split - Total: ${total}, Merchant: ${merchantAmount}, Platform Fee: ${platformFeeAmount}`,
      );

      // 2. Get merchant/seller information
      const firstOrderItem = order.items[0];
      if (!firstOrderItem) {
        throw new Error('Order has no items');
      }

      const product = await this.prisma.product.findUnique({
        where: { id: firstOrderItem.productId },
        include: {
          seller: {
            select: {
              id: true,
              companyName: true,
              payoutWalletAddress: true,
              payoutNetwork: true,
            },
          },
        },
      });

      if (!product || !product.seller) {
        throw new Error('Product or seller not found');
      }

      const seller = product.seller;

      // 3. Validate merchant payout configuration
      if (!seller.payoutWalletAddress || !seller.payoutNetwork) {
        throw new Error(
          `Merchant ${seller.companyName} has not configured payout wallet. Please configure in merchant settings.`,
        );
      }

      // 4. Get network and ensure it matches
      const orderNetwork = (order.network as NetworkType) || seller.payoutNetwork;

      // 5. Get platform owner wallet address for this network
      const platformWalletAddress = this.getPlatformWalletAddress(orderNetwork);

      if (!platformWalletAddress) {
        throw new Error(
          `Platform owner wallet not configured for network: ${orderNetwork}`,
        );
      }

      // 6. Transfer to merchant
      this.logger.log(
        `Transferring ${merchantAmount} ${order.stablecoinType} to merchant: ${seller.companyName}`,
      );

      const merchantTxHash = await this.blockchainService.transfer(
        orderNetwork,
        order.stablecoinType,
        seller.payoutWalletAddress,
        merchantAmount,
      );

      this.logger.log(
        `Merchant payment successful. TxHash: ${merchantTxHash}`,
      );

      // 7. Transfer platform fee to owner
      this.logger.log(
        `Transferring ${platformFeeAmount} ${order.stablecoinType} platform fee`,
      );

      const platformTxHash = await this.blockchainService.transfer(
        orderNetwork,
        order.stablecoinType,
        platformWalletAddress,
        platformFeeAmount,
      );

      this.logger.log(
        `Platform fee payment successful. TxHash: ${platformTxHash}`,
      );

      // 8. Record seller payout in database
      const sellerPayout = await this.prisma.sellerPayout.create({
        data: {
          sellerId: seller.id,
          grossAmount: total,
          platformFee: platformFeeAmount,
          netAmount: merchantAmount,
          stablecoinType: order.stablecoinType,
          network: orderNetwork,
          payoutMethod: 'CRYPTO',
          walletAddress: seller.payoutWalletAddress,
          txHash: merchantTxHash,
          status: SellerPayoutStatus.COMPLETED,
          periodStart: order.createdAt,
          periodEnd: new Date(),
          completedAt: new Date(),
        },
      });

      this.logger.log(
        `Seller payout record created: ${sellerPayout.id}`,
      );

      // 9. Update order with platform fee and transaction hashes
      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          platformFee: platformFeeAmount,
          metadata: {
            ...(order.metadata as object),
            merchantTxHash,
            platformTxHash,
            sellerPayoutId: sellerPayout.id,
            distributedAt: new Date().toISOString(),
          },
        },
      });

      return {
        merchantTxHash,
        platformTxHash,
        merchantAmount,
        platformFeeAmount,
        sellerPayoutId: sellerPayout.id,
      };
    } catch (error) {
      this.logger.error(
        `Payment distribution failed for order ${order.orderNumber}: ${error.message}`,
        error.stack,
      );

      // Record failed payout attempt
      try {
        const firstOrderItem = order.items[0];
        if (firstOrderItem) {
          const product = await this.prisma.product.findUnique({
            where: { id: firstOrderItem.productId },
            select: { sellerId: true },
          });

          if (product) {
            await this.prisma.sellerPayout.create({
              data: {
                sellerId: product.sellerId,
                grossAmount: new Decimal(order.total.toString()),
                platformFee: new Decimal(order.total.toString()).mul(
                  this.PLATFORM_FEE_PERCENTAGE,
                ),
                netAmount: new Decimal(order.total.toString()).mul(
                  1 - this.PLATFORM_FEE_PERCENTAGE,
                ),
                stablecoinType: order.stablecoinType,
                network: order.network,
                payoutMethod: 'CRYPTO',
                status: SellerPayoutStatus.FAILED,
                periodStart: order.createdAt,
                periodEnd: new Date(),
                failedAt: new Date(),
                failureReason: error.message,
              },
            });
          }
        }
      } catch (recordError) {
        this.logger.error(
          `Failed to record failed payout: ${recordError.message}`,
        );
      }

      throw error;
    }
  }

  /**
   * Get platform owner wallet address for a specific network
   */
  private getPlatformWalletAddress(network: NetworkType): string | null {
    const envKey = `PLATFORM_OWNER_WALLET_${network}`;
    const walletAddress = this.configService.get<string>(envKey);

    if (!walletAddress) {
      this.logger.warn(
        `Platform owner wallet not configured for network: ${network}. Please set ${envKey} in environment variables.`,
      );
      return null;
    }

    return walletAddress;
  }

  /**
   * Retry failed payment distribution
   */
  async retryFailedDistribution(orderId: string): Promise<PaymentDistributionResult> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    return this.distributeOrderPayment(order);
  }

  /**
   * Get platform owner wallet addresses (for admin configuration UI)
   */
  getPlatformWalletAddresses(): Record<NetworkType, string | null> {
    const networks: NetworkType[] = [
      NetworkType.ETHEREUM,
      NetworkType.POLYGON,
      NetworkType.BSC,
      NetworkType.ARBITRUM,
      NetworkType.OPTIMISM,
      NetworkType.AVALANCHE,
      NetworkType.BASE,
      NetworkType.SUI,
      NetworkType.TON,
      NetworkType.SOLANA,
    ];

    const wallets: Record<string, string | null> = {};

    for (const network of networks) {
      wallets[network] = this.getPlatformWalletAddress(network);
    }

    return wallets as Record<NetworkType, string | null>;
  }
}
