import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';
import { RewardsService } from '../rewards/rewards.service';
import { UserManagementService } from '../user-management/user-management.service';
import { EmailService } from '../auth/services/email.service';
import { PaymentDistributionService } from './services/payment-distribution.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import {
  OrderStatus,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private readonly PLATFORM_MARKUP = 1.20; // 20% markup - customers pay this, merchants get base price

  constructor(
    private prisma: PrismaService,
    private walletsService: WalletsService,
    private rewardsService: RewardsService,
    private userManagementService: UserManagementService,
    private emailService: EmailService,
    private paymentDistributionService: PaymentDistributionService,
  ) {}

  private generateOrderNumber(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 7);
    return `ORD-${timestamp}-${random}`.toUpperCase();
  }

  async create(userId: string, createOrderDto: CreateOrderDto) {
    const { stablecoinType, items, shippingAddress, metadata } = createOrderDto;

    // Validate products and calculate totals
    let subtotal = new Decimal(0);
    const orderItems: any[] = [];

    for (const item of items) {
      const product = await this.prisma.product.findUnique({
        where: { id: item.productId },
        include: {
          prices: {
            where: { stablecoinType },
          },
        },
      });

      if (!product) {
        throw new NotFoundException(`Product ${item.productId} not found`);
      }

      if (product.status !== 'ACTIVE') {
        throw new BadRequestException(
          `Product ${product.name} is not available`,
        );
      }

      const price = product.prices[0];
      if (!price) {
        throw new BadRequestException(
          `Product ${product.name} price not available in ${stablecoinType}`,
        );
      }

      // Validate shipping country against product's available countries
      if (shippingAddress?.country) {
        const shippingCountry = shippingAddress.country.toUpperCase().trim();
        const availableCountries = product.availableCountries || [];

        // Empty array means worldwide availability
        const isWorldwide = availableCountries.length === 0;
        const isAvailableInCountry = availableCountries.some(
          (country) => country.toUpperCase().trim() === shippingCountry
        );

        if (!isWorldwide && !isAvailableInCountry) {
          throw new BadRequestException(
            `Some products can't be shipped to ${shippingCountry}. Please remove them from your cart or select a different shipping country.`
          );
        }
      }

      // Apply 20% platform markup to merchant's base price
      const platformPrice = new Decimal(price.price).mul(this.PLATFORM_MARKUP);
      const itemTotal = platformPrice.mul(item.quantity);
      subtotal = subtotal.add(itemTotal);

      orderItems.push({
        productId: product.id,
        quantity: item.quantity,
        stablecoinType,
        pricePerUnit: platformPrice, // Customer pays platform price (merchant price + 20%)
        totalPrice: itemTotal,
      });
    }

    // Calculate tax (example: 10%)
    const tax = subtotal.mul(0.1);
    const total = subtotal.add(tax);

    // Extract smart contract payment details from metadata
    const isSmartContractPayment = metadata?.paymentMethod === 'smart_contract';
    const transactionHash = metadata?.transactionHash;
    const network = metadata?.network;

    // Check user wallet balance only if NOT a smart contract payment
    let wallet: any = null;
    if (!isSmartContractPayment) {
      // Use network from metadata if provided (for deposit payments), otherwise default to POLYGON
      const depositNetwork = metadata?.network || 'POLYGON';

      wallet = await this.prisma.wallet.findUnique({
        where: {
          userId_stablecoinType_network: {
            userId,
            stablecoinType,
            network: depositNetwork,
          },
        },
      });

      if (!wallet) {
        throw new BadRequestException(
          `No ${stablecoinType} wallet found on ${depositNetwork} network. Please create a wallet or select a different network.`,
        );
      }

      const availableBalance = new Decimal(wallet.balance.toString()).sub(
        new Decimal(wallet.lockedBalance.toString()),
      );

      if (availableBalance.lessThan(total)) {
        throw new BadRequestException(
          `Insufficient balance. Required: ${total.toString()} ${stablecoinType}, Available: ${availableBalance.toString()} ${stablecoinType}`,
        );
      }
    }

    // For deposit payments, process payment immediately in a transaction
    // For smart contract payments, create order and wait for blockchain confirmation
    if (!isSmartContractPayment && wallet) {
      // SEC-BE-007 FIX: Add proper error handling with transaction rollback
      const previousBalance = wallet.balance;
      let order;

      try {
        // Deposit payment: Process everything in a single transaction with proper rollback
        order = await this.prisma.$transaction(async (tx) => {
        // SEC-BE-006 FIX: Use SELECT FOR UPDATE to lock wallet row and prevent race conditions
        // This ensures atomicity: no other transaction can read/modify this wallet until we commit
        const currentWallet = await tx.$queryRaw<Array<{ id: string; balance: any; lockedBalance: any }>>`
          SELECT id, balance, "lockedBalance"
          FROM "Wallet"
          WHERE id = ${wallet.id}
          FOR UPDATE
        `;

        if (!currentWallet || currentWallet.length === 0) {
          throw new BadRequestException('Wallet not found');
        }

        const walletData = currentWallet[0];
        const availableBalance = new Decimal(walletData.balance.toString()).sub(
          new Decimal(walletData.lockedBalance.toString()),
        );

        if (availableBalance.lessThan(total)) {
          throw new BadRequestException(
            `Insufficient balance. Required: ${total.toString()} ${stablecoinType}, Available: ${availableBalance.toString()} ${stablecoinType}`,
          );
        }

        // 2. Create order with CONFIRMED status
        const newOrder = await tx.order.create({
          data: {
            userId,
            orderNumber: this.generateOrderNumber(),
            stablecoinType,
            subtotal,
            tax,
            total,
            status: OrderStatus.CONFIRMED,
            network: wallet.network,
            metadata,
            shippingAddress: (shippingAddress
              ? JSON.parse(JSON.stringify(shippingAddress))
              : undefined) as any,
            paidAt: new Date(),
            items: {
              create: orderItems,
            },
          },
          include: {
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    imageUrl: true,
                  },
                },
              },
            },
          },
        });

        // 3. Create transaction record BEFORE deducting balance (with PENDING status)
        const transaction = await tx.transaction.create({
          data: {
            userId,
            orderId: newOrder.id,
            type: TransactionType.PURCHASE,
            status: TransactionStatus.PENDING,
            stablecoinType,
            network: wallet.network,
            amount: total,
            fee: 0,
          },
        });

        // 4. Deduct from wallet balance (this happens last, so rollback is automatic if it fails)
        await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            balance: { decrement: total },
          },
        });

        // 5. Update transaction status to COMPLETED
        await tx.transaction.update({
          where: { id: transaction.id },
          data: { status: TransactionStatus.COMPLETED },
        });

        return newOrder;
      }, {
        timeout: 10000, // 10 second timeout
        maxWait: 15000, // Maximum time to wait for transaction to start
        isolationLevel: 'Serializable', // SEC-BE-007 FIX: Strictest isolation level
      });

        this.logger.log(`Deposit payment order created and confirmed: ${order.orderNumber}`);

        // Distribute payment to merchant and platform owner asynchronously
        this.paymentDistributionService.distributeOrderPayment(order).catch((error) => {
          this.logger.error(`Failed to distribute payment for order ${order.id}`, error);
          // Note: Order is already confirmed, but payment distribution failed
          // This should trigger manual intervention or retry logic
        });

        // Process rewards and user type upgrades asynchronously
        this.processPostOrderRewards(order).catch((error) => {
          this.logger.error(`Failed to process rewards for order ${order.id}`, error);
        });

        return order;
      } catch (error) {
        // SEC-BE-007 FIX: Transaction automatically rolled back on error
        this.logger.error('Order transaction failed, automatically rolled back', error);

        // Verify rollback worked (balance should be unchanged)
        const walletAfterError = await this.prisma.wallet.findUnique({
          where: { id: wallet.id },
          select: { balance: true },
        });

        if (walletAfterError && walletAfterError.balance.toString() !== previousBalance.toString()) {
          // CRITICAL: Rollback failed, manual intervention needed
          this.logger.error(
            `🔴 CRITICAL: Transaction rollback verification failed for wallet ${wallet.id}`,
            {
              expectedBalance: previousBalance.toString(),
              actualBalance: walletAfterError.balance.toString(),
              userId,
              error: error.message,
            },
          );

          // TODO: Send alert to admins via notification service
          // await this.notificationService.sendCriticalAlert(...)
        }

        throw new BadRequestException(
          'Order creation failed. Your balance has not been affected. Please try again.',
        );
      }
    } else {
      // Smart contract payment: Create order with PAYMENT_PENDING status
      const order = await this.prisma.order.create({
        data: {
          userId,
          orderNumber: this.generateOrderNumber(),
          stablecoinType,
          subtotal,
          tax,
          total,
          status: OrderStatus.PAYMENT_PENDING,
          transactionHash: transactionHash || undefined,
          network: network || undefined,
          metadata,
          shippingAddress: (shippingAddress
            ? JSON.parse(JSON.stringify(shippingAddress))
            : undefined) as any,
          items: {
            create: orderItems,
          },
        },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  imageUrl: true,
                },
              },
            },
          },
        },
      });

      // Create pending transaction record for smart contract payment
      await this.prisma.transaction.create({
        data: {
          userId,
          orderId: order.id,
          type: TransactionType.PURCHASE,
          status: TransactionStatus.PENDING,
          stablecoinType,
          network: network || 'ETHEREUM',
          amount: total,
          fee: 0,
        },
      });

      this.logger.log(`Smart contract payment order created: ${order.orderNumber}, awaiting blockchain confirmation`);

      return order;
    }
  }

  async confirmPayment(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Verify ownership - CRITICAL SECURITY CHECK
    if (order.userId !== userId) {
      throw new ForbiddenException('You do not have permission to confirm this order');
    }

    if (order.status !== OrderStatus.PAYMENT_PENDING) {
      throw new BadRequestException('Order payment already processed');
    }

    // Get the network from order metadata or default to POLYGON
    const metadata = order.metadata as any;
    const orderNetwork = metadata?.network || 'POLYGON';

    // Get wallet
    const wallet = await this.prisma.wallet.findUnique({
      where: {
        userId_stablecoinType_network: {
          userId: order.userId,
          stablecoinType: order.stablecoinType,
          network: orderNetwork,
        },
      },
    });

    if (!wallet) {
      throw new NotFoundException(`Wallet not found for ${order.stablecoinType} on ${orderNetwork} network`);
    }

    // Deduct from balance and unlock
    const total = new Decimal(order.total.toString());

    await this.prisma.$transaction([
      // Update wallet balance
      this.prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { decrement: total },
          lockedBalance: { decrement: total },
        },
      }),
      // Update order status
      this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CONFIRMED,
          paidAt: new Date(),
        },
      }),
      // Update transaction
      this.prisma.transaction.updateMany({
        where: { orderId },
        data: {
          status: TransactionStatus.COMPLETED,
        },
      }),
    ]);

    this.logger.log(`Payment confirmed for order: ${order.orderNumber}`);

    // Get updated order with items for payment distribution
    const orderWithItems = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    // Distribute payment to merchant and platform owner asynchronously
    if (orderWithItems) {
      this.paymentDistributionService.distributeOrderPayment(orderWithItems).catch((error) => {
        this.logger.error(`Failed to distribute payment for order ${orderId}`, error);
        // Note: Order is already confirmed, but payment distribution failed
        // This should trigger manual intervention or retry logic
      });
    }

    // Process rewards and user type upgrades asynchronously
    this.processPostOrderRewards(order).catch((error) => {
      this.logger.error(`Failed to process rewards for order ${orderId}`, error);
    });

    // Send order confirmation email asynchronously
    this.sendOrderConfirmationEmail(order).catch((error) => {
      this.logger.error(
        `Failed to send order confirmation email for order ${orderId}`,
        error,
      );
    });

    return this.findOne(orderId, order.userId);
  }

  /**
   * Send order confirmation email
   */
  private async sendOrderConfirmationEmail(order: any) {
    try {
      // Get user details
      const user = await this.prisma.user.findUnique({
        where: { id: order.userId },
      });

      if (!user?.email) {
        this.logger.warn(
          `No email found for user ${order.userId}, skipping order confirmation email`,
        );
        return;
      }

      // Get order with items
      const orderWithItems = await this.prisma.order.findUnique({
        where: { id: order.id },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      if (!orderWithItems) return;

      // Format order items for email
      const orderItems = orderWithItems.items.map((item) => ({
        name: item.product.name,
        quantity: item.quantity,
        price: item.pricePerUnit.toString(),
        total: item.totalPrice.toString(),
      }));

      // Format shipping address
      const shippingAddress =
        typeof orderWithItems.shippingAddress === 'string'
          ? orderWithItems.shippingAddress
          : JSON.stringify(orderWithItems.shippingAddress, null, 2);

      await this.emailService.sendOrderConfirmedEmail(user.email, {
        firstName: user.email.split('@')[0],
        orderNumber: orderWithItems.orderNumber,
        orderItems,
        totalAmount: orderWithItems.total.toString(),
        stablecoin: orderWithItems.stablecoinType,
        transactionHash: orderWithItems.transactionHash || 'Processing',
        shippingAddress,
        estimatedDelivery: 'Within 5-7 business days',
      });
    } catch (error) {
      this.logger.error(
        `Error in sendOrderConfirmationEmail: ${error.message}`,
      );
    }
  }

  /**
   * Process rewards and user type upgrades after order confirmation
   */
  private async processPostOrderRewards(order: any) {
    try {
      // 1. Create purchase reward
      await this.rewardsService.createPurchaseReward(
        order.userId,
        order.id,
        parseFloat(order.total.toString()),
        order.stablecoinType,
      );

      // 2. Update user's total spent amount
      await this.userManagementService.updateUserSpent(
        order.userId,
        parseFloat(order.total.toString()),
      );

      // 3. Check if user was referred and reward referrer
      const user = await this.prisma.user.findUnique({
        where: { id: order.userId },
        select: { referredBy: true },
      });

      if (user?.referredBy) {
        // Check if this is the first purchase by referee
        const orderCount = await this.prisma.order.count({
          where: { userId: order.userId, status: OrderStatus.CONFIRMED },
        });

        if (orderCount === 1) {
          // First purchase - create referral rewards
          await this.rewardsService.createReferralReward(
            user.referredBy,
            order.userId,
            order.id,
          );

          // Update referrer's referral count
          await this.userManagementService.updateReferralCount(user.referredBy);
        }
      }

      this.logger.log(
        `Post-order rewards processed for order ${order.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Error processing post-order rewards for order ${order.id}`,
        error,
      );
      throw error;
    }
  }

  async findAll(
    userId: string,
    filters?: { status?: OrderStatus; page?: number; limit?: number },
  ) {
    const { status, page = 1, limit = 20 } = filters || {};
    const skip = (page - 1) * limit;

    const where: any = { userId };

    if (status) where.status = status;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  imageUrl: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),

      this.prisma.order.count({ where }),
    ]);

    return {
      orders,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, userId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, userId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
                images: true,
                description: true,
              },
            },
          },
        },
        transactions: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async cancelOrder(orderId: string, userId: string) {
    const order = await this.findOne(orderId, userId);

    if (
      order.status !== OrderStatus.PAYMENT_PENDING &&
      order.status !== OrderStatus.PENDING
    ) {
      throw new BadRequestException('Order cannot be cancelled');
    }

    // Get wallet
    const wallet = await this.prisma.wallet.findUnique({
      where: {
        userId_stablecoinType_network: {
          userId: order.userId,
          stablecoinType: order.stablecoinType,
          network: 'POLYGON',
        },
      },
    });

    if (wallet) {
      // Unlock balance
      const total = new Decimal(order.total.toString());
      await this.walletsService.unlockBalance(wallet.id, total);
    }

    // Update order
    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.CANCELLED,
        cancelledAt: new Date(),
      },
    });

    // Update transaction
    await this.prisma.transaction.updateMany({
      where: { orderId },
      data: { status: TransactionStatus.CANCELLED },
    });

    this.logger.log(`Order cancelled: ${order.orderNumber}`);

    return { message: 'Order cancelled successfully' };
  }

  // Admin functions
  async findAllOrders(filters?: {
    status?: OrderStatus;
    userId?: string;
    page?: number;
    limit?: number;
  }) {
    const { status, userId, page = 1, limit = 20 } = filters || {};
    const skip = (page - 1) * limit;

    const where: any = {};

    if (status) where.status = status;

    if (userId) where.userId = userId;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),

      this.prisma.order.count({ where }),
    ]);

    return {
      orders,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateOrderStatus(
    orderId: string,
    updateStatusDto: UpdateOrderStatusDto,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const updateData: any = {
      status: updateStatusDto.status,
    };

    if (updateStatusDto.trackingNumber) {
      updateData.trackingNumber = updateStatusDto.trackingNumber;
    }

    if (updateStatusDto.status === OrderStatus.SHIPPED) {
      updateData.shippedAt = new Date();
    }

    if (updateStatusDto.status === OrderStatus.DELIVERED) {
      updateData.deliveredAt = new Date();
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },

      data: updateData,
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    this.logger.log(
      `Order ${order.orderNumber} status updated to ${updateStatusDto.status}`,
    );

    // Send order shipped email if status changed to SHIPPED
    if (updateStatusDto.status === OrderStatus.SHIPPED) {
      this.sendOrderShippedEmail(updatedOrder, updateStatusDto.trackingNumber).catch(
        (error) => {
          this.logger.error(
            `Failed to send order shipped email for order ${orderId}`,
            error,
          );
        },
      );
    }

    return updatedOrder;
  }

  /**
   * Send order shipped email
   */
  private async sendOrderShippedEmail(order: any, trackingNumber?: string) {
    try {
      // Get user details
      const user = await this.prisma.user.findUnique({
        where: { id: order.userId },
      });

      if (!user?.email) {
        this.logger.warn(
          `No email found for user ${order.userId}, skipping order shipped email`,
        );
        return;
      }

      // Format shipping address
      const shippingAddress =
        typeof order.shippingAddress === 'string'
          ? order.shippingAddress
          : JSON.stringify(order.shippingAddress, null, 2);

      await this.emailService.sendOrderShippedEmail(user.email, {
        firstName: user.email.split('@')[0],
        orderNumber: order.orderNumber,
        trackingNumber: trackingNumber || order.trackingNumber || 'N/A',
        carrier: 'Carrier', // You can enhance this to accept carrier from DTO
        trackingUrl: trackingNumber
          ? `https://www.trackingmore.com/track/${trackingNumber}`
          : undefined,
        estimatedDelivery: 'Within 3-5 business days',
        shippingAddress,
      });
    } catch (error) {
      this.logger.error(`Error in sendOrderShippedEmail: ${error.message}`);
    }
  }

  async getOrderStats() {
    // Calculate total revenue from all confirmed/completed orders
    const orders = await this.prisma.order.findMany({
      where: {
        status: {
          in: [
            OrderStatus.CONFIRMED,
            OrderStatus.PROCESSING,
            OrderStatus.SHIPPED,
            OrderStatus.DELIVERED,
          ],
        },
      },
      select: {
        total: true,
      },
    });

    const totalRevenue = orders.reduce((sum, order) => {
      return sum + parseFloat(order.total.toString());
    }, 0);

    // Count orders by status
    const ordersByStatus = await this.prisma.order.groupBy({
      by: ['status'],
      _count: true,
    });

    const totalOrders = await this.prisma.order.count();

    return {
      totalRevenue,
      totalOrders,
      ordersByStatus,
    };
  }
}
