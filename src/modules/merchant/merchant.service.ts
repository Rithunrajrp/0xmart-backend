import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class MerchantService {
  constructor(private prisma: PrismaService) {}

  async getMerchantStats(userId: string) {
    // Find the seller linked to this user
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
      include: {
        products: {
          where: { status: { not: 'REJECTED' } },
        },
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!seller) {
      throw new NotFoundException('Merchant profile not found for this user');
    }

    // Get orders for this seller's products
    const orders = await this.prisma.order.findMany({
      where: {
        items: {
          some: {
            product: {
              sellerId: seller.id,
            },
          },
        },
      },
      include: {
        items: {
          where: {
            product: {
              sellerId: seller.id,
            },
          },
          include: {
            product: true,
          },
        },
      },
    });

    // Calculate revenue (sum of all completed orders)
    const completedOrders = orders.filter((o) =>
      ['PAYMENT_CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'].includes(
        o.status,
      ),
    );

    const totalRevenue = completedOrders.reduce((sum, order) => {
      const sellerItemsTotal = order.items.reduce(
        (itemSum, item) => itemSum.add(new Decimal(item.totalPrice)),
        new Decimal(0),
      );
      return sum.add(sellerItemsTotal);
    }, new Decimal(0));

    // Calculate monthly revenue (current month)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyOrders = completedOrders.filter(
      (o) => new Date(o.createdAt) >= startOfMonth,
    );
    const monthlyRevenue = monthlyOrders.reduce((sum, order) => {
      const sellerItemsTotal = order.items.reduce(
        (itemSum, item) => itemSum.add(new Decimal(item.totalPrice)),
        new Decimal(0),
      );
      return sum.add(sellerItemsTotal);
    }, new Decimal(0));

    // Count pending orders
    const pendingOrders = orders.filter((o) =>
      ['PAYMENT_CONFIRMED', 'PROCESSING'].includes(o.status),
    ).length;

    // Count active products
    const activeProducts = seller.products.filter(
      (p) => p.status === 'ACTIVE',
    ).length;

    // Get unique customers
    const uniqueCustomerIds = new Set(orders.map((o) => o.userId));

    return {
      totalRevenue: totalRevenue.toFixed(2),
      monthlyRevenue: monthlyRevenue.toFixed(2),
      totalOrders: orders.length,
      pendingOrders,
      totalProducts: seller.products.length,
      activeProducts,
      totalCustomers: uniqueCustomerIds.size,
      rating: seller.rating.toFixed(1),
      totalReviews: seller.totalReviews,
    };
  }

  async getMerchantOrders(userId: string, limit: number = 5) {
    // Find the seller linked to this user
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
    });

    if (!seller) {
      throw new NotFoundException('Merchant profile not found for this user');
    }

    // Get recent orders for this seller's products
    const orders = await this.prisma.order.findMany({
      where: {
        items: {
          some: {
            product: {
              sellerId: seller.id,
            },
          },
        },
      },
      include: {
        user: {
          select: {
            email: true,
          },
        },
        items: {
          where: {
            product: {
              sellerId: seller.id,
            },
          },
          include: {
            product: true,
          },
        },
        shippingAddr: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    return orders.map((order) => {
      const sellerItemsTotal = order.items.reduce(
        (sum, item) => sum.add(new Decimal(item.totalPrice)),
        new Decimal(0),
      );

      return {
        id: order.id,
        orderNumber: order.orderNumber,
        customerEmail: order.user.email,
        customerName: order.shippingAddr?.fullName || 'N/A',
        total: sellerItemsTotal.toFixed(2),
        currency: order.stablecoinType,
        status: order.status,
        createdAt: order.createdAt,
      };
    });
  }
}
