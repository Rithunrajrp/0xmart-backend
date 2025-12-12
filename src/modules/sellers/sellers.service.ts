import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class SellersService {
  private readonly logger = new Logger(SellersService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get seller details by ID (public info only)
   */
  async getSellerPublicInfo(sellerId: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
      select: {
        id: true,
        companyName: true,
        tradingName: true,
        sellerType: true,
        status: true,
        logo: true,
        banner: true,
        description: true,
        website: true,
        city: true,
        state: true,
        country: true,
        rating: true,
        totalReviews: true,
        totalSales: true,
        verifiedAt: true,
        createdAt: true,
      },
    });

    if (!seller) {
      throw new NotFoundException('Seller not found');
    }

    return {
      id: seller.id,
      name: seller.companyName,
      tradingName: seller.tradingName,
      type: seller.sellerType,
      isVerified: seller.status === 'VERIFIED',
      verifiedAt: seller.verifiedAt,
      logo: seller.logo,
      banner: seller.banner,
      description: seller.description,
      website: seller.website,
      location: {
        city: seller.city,
        state: seller.state,
        country: seller.country,
      },
      stats: {
        rating: seller.rating.toString(),
        totalReviews: seller.totalReviews,
        totalSales: seller.totalSales,
      },
      memberSince: seller.createdAt,
    };
  }

  /**
   * Get seller's products
   */
  async getSellerProducts(
    sellerId: string,
    options: {
      page?: number;
      limit?: number;
      category?: string;
    } = {},
  ) {
    const { page = 1, limit = 20, category } = options;

    const where: any = {
      sellerId,
      status: 'ACTIVE',
    };

    if (category) {
      where.category = { contains: category, mode: 'insensitive' };
    }

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          prices: true,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        shortDescription: p.shortDescription,
        imageUrl: p.imageUrl,
        category: p.category,
        brand: p.brand,
        rating: p.rating.toString(),
        totalReviews: p.totalReviews,
        stock: p.stock,
        prices: p.prices.map((pr) => ({
          currency: pr.stablecoinType,
          price: pr.price.toString(),
        })),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * List verified sellers
   */
  async listVerifiedSellers(
    options: {
      page?: number;
      limit?: number;
      country?: string;
      type?: string;
    } = {},
  ) {
    const { page = 1, limit = 20, country, type } = options;

    const where: any = {
      status: 'VERIFIED',
    };

    if (country) {
      where.country = { equals: country, mode: 'insensitive' };
    }

    if (type) {
      where.sellerType = type;
    }

    const [sellers, total] = await Promise.all([
      this.prisma.seller.findMany({
        where,
        select: {
          id: true,
          companyName: true,
          tradingName: true,
          sellerType: true,
          logo: true,
          description: true,
          city: true,
          country: true,
          rating: true,
          totalReviews: true,
          totalSales: true,
          _count: { select: { products: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { rating: 'desc' },
      }),
      this.prisma.seller.count({ where }),
    ]);

    return {
      sellers: sellers.map((s) => ({
        id: s.id,
        name: s.companyName,
        tradingName: s.tradingName,
        type: s.sellerType,
        logo: s.logo,
        description: s.description?.substring(0, 200),
        location: `${s.city || ''}, ${s.country}`.replace(/^, /, ''),
        rating: s.rating.toString(),
        totalReviews: s.totalReviews,
        totalSales: s.totalSales,
        productCount: s._count.products,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get product with seller info (for API responses)
   */
  async getProductWithSeller(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        prices: true,
        seller: {
          select: {
            id: true,
            companyName: true,
            tradingName: true,
            sellerType: true,
            status: true,
            logo: true,
            country: true,
            rating: true,
            totalReviews: true,
            verifiedAt: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return {
      product: {
        id: product.id,
        name: product.name,
        description: product.description,
        shortDescription: product.shortDescription,
        imageUrl: product.imageUrl,
        images: product.images,
        category: product.category,
        subcategory: product.subcategory,
        brand: product.brand,
        sku: product.sku,
        stock: product.stock,
        weight: product.weight?.toString(),
        dimensions: product.dimensions,
        specifications: product.specifications,
        rating: product.rating.toString(),
        totalReviews: product.totalReviews,
        isFeatured: product.isFeatured,
        isDigital: product.isDigital,
        prices: product.prices.map((p) => ({
          currency: p.stablecoinType,
          price: p.price.toString(),
        })),
      },
      seller: {
        id: product.seller.id,
        name: product.seller.companyName,
        tradingName: product.seller.tradingName,
        type: product.seller.sellerType,
        isVerified: product.seller.status === 'VERIFIED',
        verifiedAt: product.seller.verifiedAt,
        logo: product.seller.logo,
        country: product.seller.country,
        rating: product.seller.rating.toString(),
        totalReviews: product.seller.totalReviews,
      },
    };
  }
}
