import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';
import { RewardsService } from '../rewards/rewards.service';
import { UserManagementService } from '../user-management/user-management.service';
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

  constructor(
    private prisma: PrismaService,
    private walletsService: WalletsService,
    private rewardsService: RewardsService,
    private userManagementService: UserManagementService,
  ) {}

  private generateOrderNumber(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 7);
    return `ORD-${timestamp}-${random}`.toUpperCase();
  }

  async create(userId: string, createOrderDto: CreateOrderDto) {
    const { stablecoinType, items, shippingAddress } = createOrderDto;

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

      const itemTotal = new Decimal(price.price).mul(item.quantity);
      subtotal = subtotal.add(itemTotal);

      orderItems.push({
        productId: product.id,
        quantity: item.quantity,
        stablecoinType,
        pricePerUnit: price.price,
        totalPrice: itemTotal,
      });
    }

    // Calculate tax (example: 10%)
    const tax = subtotal.mul(0.1);
    const total = subtotal.add(tax);

    // Check user wallet balance
    const wallet = await this.prisma.wallet.findUnique({
      where: {
        userId_stablecoinType_network: {
          userId,
          stablecoinType,
          network: 'POLYGON', // Default to Polygon for orders
        },
      },
    });

    if (!wallet) {
      throw new BadRequestException(
        `No ${stablecoinType} wallet found. Please create a wallet first.`,
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

    // Create order
    const order = await this.prisma.order.create({
      data: {
        userId,
        orderNumber: this.generateOrderNumber(),
        stablecoinType,
        subtotal,
        tax,
        total,
        status: OrderStatus.PAYMENT_PENDING,

        shippingAddress,
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

    // Lock balance
    await this.walletsService.lockBalance(wallet.id, total);

    // Create transaction record
    await this.prisma.transaction.create({
      data: {
        userId,
        orderId: order.id,
        type: TransactionType.PURCHASE,
        status: TransactionStatus.PENDING,
        stablecoinType,
        network: 'POLYGON',
        amount: total,
        fee: 0,
      },
    });

    this.logger.log(`Order created: ${order.orderNumber} for user ${userId}`);

    return order;
  }

  async confirmPayment(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== OrderStatus.PAYMENT_PENDING) {
      throw new BadRequestException('Order payment already processed');
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

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
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

    // Process rewards and user type upgrades asynchronously
    this.processPostOrderRewards(order).catch((error) => {
      this.logger.error(`Failed to process rewards for order ${orderId}`, error);
    });

    return this.findOne(orderId, order.userId);
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

    return updatedOrder;
  }
}
