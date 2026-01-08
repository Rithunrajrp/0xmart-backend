import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import * as crypto from 'crypto';
import { Decimal } from '@prisma/client/runtime/library';

interface RecommendationQuery {
  category?: string;
  priceRange?: { min: number; max: number };
  location?: string;
  userType?: string;
  keywords?: string[];
  customerSessionId?: string;
  limit?: number;
}

@Injectable()
export class AdsService {
  private readonly logger = new Logger(AdsService.name);

  // Click token expiration (24 hours)
  private readonly CLICK_TOKEN_EXPIRY_HOURS = 24;

  constructor(private prisma: PrismaService) {}

  /**
   * Generate unique click tracking token
   */
  private generateClickToken(): string {
    return `click_${crypto.randomBytes(16).toString('hex')}`;
  }

  /**
   * Get product recommendations based on customer preferences
   */
  async getRecommendations(
    apiKeyId: string,
    query: RecommendationQuery & {
      productIds?: string[];
      productNames?: string[];
    },
  ) {
    // Get API key with recommendation config
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { id: apiKeyId },
      include: { recommendationConfig: true },
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    let products: any[] = [];
    let recommendationSource = 'algorithm';

    // PRIORITY 1: Specific product IDs/names in request (highest priority)
    if (
      (query.productIds && query.productIds.length > 0) ||
      (query.productNames && query.productNames.length > 0)
    ) {
      products = await this.getProductsByIdsOrNames(
        query.productIds,
        query.productNames,
      );
      recommendationSource = 'direct_request';
    }
    // PRIORITY 2: Personalized recommendations from API key config
    else if (
      apiKey.usePersonalizedRecommendations &&
      apiKey.recommendationConfig
    ) {
      products = await this.getPersonalizedRecommendations(
        apiKey.recommendationConfig,
        query,
      );
      recommendationSource = 'personalized_config';
    }
    // PRIORITY 3: Fallback to algorithm-based recommendations
    else {
      products = await this.getAlgorithmRecommendations(query);
      recommendationSource = 'algorithm';
    }

    // Apply customer filters (category, price range, etc.)
    products = this.applyCustomerFilters(products, query);

    // Limit results
    const limit = query.limit || 10;
    products = products.slice(0, limit);

    // Create ad click records for tracking
    const recommendations = await Promise.all(
      products.map(async (product) => {
        const clickToken = this.generateClickToken();
        const expiresAt = new Date();
        expiresAt.setHours(
          expiresAt.getHours() + this.CLICK_TOKEN_EXPIRY_HOURS,
        );

        // Store click token for tracking
        await this.prisma.adClick.create({
          data: {
            apiKeyId,
            productId: product.id,
            clickToken,
            customerSessionId: query.customerSessionId,
            customerPreferences: {
              category: query.category,
              priceRange: query.priceRange,
              location: query.location,
              userType: query.userType,
              keywords: query.keywords,
              source: recommendationSource,
            },
            expiresAt,
          },
        });

        return {
          productId: product.id,
          title: product.name,
          description: product.description,
          thumbnail: product.imageUrl,
          images: product.images,
          category: product.category,
          prices: product.prices.map((p) => ({
            currency: p.stablecoinType,
            price: p.price.toString(),
          })),
          stock: product.stock,
          adClickToken: clickToken,
        };
      }),
    );

    this.logger.log(
      `Generated ${recommendations.length} recommendations (source: ${recommendationSource}) for API key ${apiKeyId}`,
    );

    return {
      status: true,
      count: recommendations.length,
      source: recommendationSource,
      ads: recommendations,
    };
  }

  /**
   * Get products by specific IDs or names
   */
  private async getProductsByIdsOrNames(ids?: string[], names?: string[]) {
    const where: any = { status: 'ACTIVE' };

    if (ids && ids.length > 0) {
      where.id = { in: ids };
    } else if (names && names.length > 0) {
      where.name = { in: names, mode: 'insensitive' }; // Case-insensitive match
    }

    return this.prisma.product.findMany({
      where,
      include: { prices: true },
    });
  }

  /**
   * Get personalized recommendations based on API key configuration
   */
  private async getPersonalizedRecommendations(
    config: any,
    query: RecommendationQuery,
  ) {
    const where: any = { status: 'ACTIVE' };

    // Use config's product selection
    if (config.selectedProductIds?.length > 0) {
      where.id = { in: config.selectedProductIds };
    } else if (config.selectedCategories?.length > 0) {
      where.category = { in: config.selectedCategories };
    }

    // Apply config filters
    if (config.minRating) {
      where.rating = { gte: config.minRating };
    }

    let products = await this.prisma.product.findMany({
      where,
      include: { prices: true },
    });

    // Filter by price if configured
    if (config.minPrice || config.maxPrice) {
      products = products.filter((p) => {
        const price = p.prices.find((pr) => pr.stablecoinType === 'USDT');
        if (!price) return false;
        const priceValue = parseFloat(price.price.toString());

        if (config.minPrice && priceValue < parseFloat(config.minPrice))
          return false;
        if (config.maxPrice && priceValue > parseFloat(config.maxPrice))
          return false;
        return true;
      });
    }

    // Sort based on preferences
    if (config.prioritizeHighRated) {
      products.sort(
        (a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0),
      );
    }

    if (config.prioritizeInStock) {
      products.sort((a, b) => (Number(b.stock) || 0) - (Number(a.stock) || 0));
    }

    return products;
  }

  /**
   * Get algorithm-based recommendations (fallback)
   */
  private async getAlgorithmRecommendations(query: RecommendationQuery) {
    const where: any = {
      status: 'ACTIVE',
      stock: { gt: 0 }, // Only in-stock products
    };

    // Category filter
    if (query.category) {
      where.category = {
        contains: query.category,
        mode: 'insensitive',
      };
    }

    // Keyword search in name, description, and tags
    if (query.keywords && query.keywords.length > 0) {
      where.OR = [
        ...query.keywords.map((keyword) => ({
          name: { contains: keyword, mode: 'insensitive' },
        })),
        ...query.keywords.map((keyword) => ({
          description: { contains: keyword, mode: 'insensitive' },
        })),
      ];
    }

    return this.prisma.product.findMany({
      where,
      include: { prices: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Apply customer filters to product list
   */
  private applyCustomerFilters(products: any[], query: RecommendationQuery) {
    let filtered = products;

    // Filter by price range if specified in query
    if (query.priceRange) {
      filtered = filtered.filter((product) => {
        const primaryPrice = product.prices[0];
        if (!primaryPrice) return false;
        const price = Number(primaryPrice.price);
        return price >= query.priceRange!.min && price <= query.priceRange!.max;
      });
    }

    // Filter by category if specified in query
    if (query.category) {
      filtered = filtered.filter((product) =>
        product.category
          ?.toLowerCase()
          .includes(query.category!.toLowerCase()),
      );
    }

    return filtered;
  }

  /**
   * Handle ad click - return full product details
   */
  async openAd(apiKeyId: string, clickToken: string) {
    // Find and validate click token
    const adClick = await this.prisma.adClick.findUnique({
      where: { clickToken },
      include: {
        product: {
          include: {
            prices: true,
          },
        },
      },
    });

    if (!adClick) {
      throw new NotFoundException('Invalid or expired click token');
    }

    // Verify API key matches
    if (adClick.apiKeyId !== apiKeyId) {
      throw new BadRequestException(
        'Click token does not belong to this API key',
      );
    }

    // Check if expired
    if (adClick.expiresAt < new Date()) {
      throw new BadRequestException('Click token has expired');
    }

    // Update click timestamp
    await this.prisma.adClick.update({
      where: { id: adClick.id },
      data: { clickedAt: new Date() },
    });

    const product = adClick.product;

    return {
      status: true,
      product: {
        id: product.id,
        name: product.name,
        description: product.description,
        thumbnail: product.imageUrl,
        images: product.images,
        category: product.category,
        tags: product.tags,
        stock: product.stock,
        prices: product.prices.map((p) => ({
          currency: p.stablecoinType,
          price: p.price.toString(),
        })),
      },
      // For initiating purchase
      purchaseInfo: {
        adClickToken: clickToken,
        availableNetworks: ['TON', 'SUI', 'POLYGON', 'BSC', 'ARBITRUM', 'BASE'],
        acceptedStablecoins: ['USDT', 'USDC'],
        initiateEndpoint: '/api/v1/payment/initiate',
      },
    };
  }

  /**
   * Get ad analytics for an API key
   */
  async getAdAnalytics(apiKeyId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [totalImpressions, totalClicks, conversions] = await Promise.all([
      this.prisma.adClick.count({
        where: {
          apiKeyId,
          createdAt: { gte: startDate },
        },
      }),
      this.prisma.adClick.count({
        where: {
          apiKeyId,
          clickedAt: { not: null },
          createdAt: { gte: startDate },
        },
      }),
      this.prisma.adClick.count({
        where: {
          apiKeyId,
          convertedAt: { not: null },
          createdAt: { gte: startDate },
        },
      }),
    ]);

    // Get top performing products
    const topProducts = await this.prisma.adClick.groupBy({
      by: ['productId'],
      where: {
        apiKeyId,
        clickedAt: { not: null },
        createdAt: { gte: startDate },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    const productDetails = await this.prisma.product.findMany({
      where: {
        id: { in: topProducts.map((p) => p.productId) },
      },
      select: {
        id: true,
        name: true,
        category: true,
      },
    });

    const clickThroughRate =
      totalImpressions > 0
        ? ((totalClicks / totalImpressions) * 100).toFixed(2)
        : '0.00';

    const conversionRate =
      totalClicks > 0 ? ((conversions / totalClicks) * 100).toFixed(2) : '0.00';

    return {
      period: `${days} days`,
      metrics: {
        totalImpressions,
        totalClicks,
        conversions,
        clickThroughRate: `${clickThroughRate}%`,
        conversionRate: `${conversionRate}%`,
      },
      topProducts: topProducts.map((p) => {
        const details = productDetails.find((d) => d.id === p.productId);
        return {
          productId: p.productId,
          name: details?.name || 'Unknown',
          category: details?.category,
          clicks: p._count.id,
        };
      }),
    };
  }

  /**
   * Mark ad click as converted (called when order is placed)
   */
  async markConversion(clickToken: string, orderId: string) {
    const adClick = await this.prisma.adClick.findUnique({
      where: { clickToken },
    });

    if (!adClick) {
      return null;
    }

    return this.prisma.adClick.update({
      where: { id: adClick.id },
      data: {
        convertedAt: new Date(),
        orderId,
      },
    });
  }

  /**
   * Clean up expired click tokens
   */
  async cleanupExpiredTokens() {
    const result = await this.prisma.adClick.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
        clickedAt: null, // Only delete unclicked tokens
      },
    });

    this.logger.log(`Cleaned up ${result.count} expired click tokens`);
    return result.count;
  }
}
