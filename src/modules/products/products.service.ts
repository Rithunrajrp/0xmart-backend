import {
  Injectable,
  NotFoundException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateProductVariantDto } from './dto/create-product-variant.dto';
import { UpdateProductVariantDto } from './dto/update-product-variant.dto';
import { ProductStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);
  private readonly PLATFORM_MARKUP = 1.20; // 20% markup

  constructor(private prisma: PrismaService) {}

  /**
   * Transform product prices to include platform markup
   * merchantPrice (stored in DB) -> platformPrice (shown to customers)
   */
  private transformProductPrices(product: any) {
    if (product.prices && Array.isArray(product.prices)) {
      return {
        ...product,
        prices: product.prices.map((p: any) => ({
          ...p,
          merchantPrice: p.price, // Original merchant price
          price: new Decimal(p.price).mul(this.PLATFORM_MARKUP).toFixed(2), // Platform price (20% markup)
          platformPrice: new Decimal(p.price).mul(this.PLATFORM_MARKUP).toFixed(2), // Explicit platform price
        })),
      };
    }
    return product;
  }

  async create(createProductDto: CreateProductDto) {
    const { prices, sellerId, ...productData } = createProductDto;

    const product = await this.prisma.product.create({
      data: {
        ...productData,
        status: ProductStatus.ACTIVE,
        rating: new Decimal(0),
        totalReviews: 0,
        seller: {
          connect: { id: sellerId },
        },
        prices: {
          create: prices.map((p) => ({
            stablecoinType: p.stablecoinType,
            price: new Decimal(p.price),
          })),
        },
      },
      include: {
        prices: true,
        seller: true,
      },
    });

    this.logger.log(`Product created: ${product.id} - ${product.name}`);
    return product;
  }

  async findAll(filters?: {
    status?: ProductStatus;
    category?: string;
    country?: string;
    page?: number;
    limit?: number;
  }) {
    const { status, category, country, page = 1, limit = 20 } = filters || {};
    const skip = (page - 1) * limit;

    const where: any = {};

    // Default to showing only ACTIVE products if no status filter provided
    where.status = status || ProductStatus.ACTIVE;

    if (category) where.category = category;

    // Filter by available countries
    if (country) {
      // Show products that either:
      // 1. Are available worldwide (empty array)
      // 2. Include the requested country
      where.OR = [
        { availableCountries: { equals: [] } },
        { availableCountries: { has: country } },
      ];
    } else {
      // When no country specified, only show worldwide products
      // This hides country-restricted products from general listings
      where.availableCountries = { equals: [] };
    }

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        include: {
          prices: true,
          seller: {
            select: {
              id: true,
              companyName: true,
              tradingName: true,
              verifiedAt: true,
              rating: true,
              logo: true,
              isInhouse: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),

      this.prisma.product.count({ where }),
    ]);

    // Transform seller data and prices to match frontend expectations
    const transformedProducts = products.map((product) => {
      const withPlatformPrices = this.transformProductPrices(product);
      return {
        ...withPlatformPrices,
        seller: product.seller
          ? {
              id: product.seller.id,
              name: product.seller.companyName,
              tradingName: product.seller.tradingName,
              isVerified: !!product.seller.verifiedAt,
              rating: product.seller.rating?.toString(),
              logo: product.seller.logo,
              isInhouse: product.seller.isInhouse,
            }
          : null,
      };
    });

    return {
      products: transformedProducts,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        prices: true,
        variants: {
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        },
        seller: {
          select: {
            id: true,
            companyName: true,
            tradingName: true,
            verifiedAt: true,
            rating: true,
            logo: true,
            isInhouse: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Transform seller data and prices to match frontend expectations
    const withPlatformPrices = this.transformProductPrices(product);

    if (product.seller) {
      const transformedProduct = {
        ...withPlatformPrices,
        seller: {
          id: product.seller.id,
          name: product.seller.companyName,
          tradingName: product.seller.tradingName,
          isVerified: !!product.seller.verifiedAt,
          rating: product.seller.rating?.toString(),
          logo: product.seller.logo,
          isInhouse: product.seller.isInhouse,
        },
      };
      return transformedProduct;
    }

    return withPlatformPrices;
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    const { prices, ...productData } = updateProductDto;

    // Check if product exists
    await this.findOne(id);

    // Update product
    const product = await this.prisma.product.update({
      where: { id },
      data: productData,
      include: {
        prices: true,
      },
    });

    console.log(`Updated product: ${JSON.stringify(product)}`);

    // Update prices if provided
    if (prices && prices.length > 0) {
      // Delete existing prices
      await this.prisma.productPrice.deleteMany({
        where: { productId: id },
      });

      // Create new prices
      await this.prisma.productPrice.createMany({
        data: prices.map((p) => ({
          productId: id,
          stablecoinType: p.stablecoinType,
          price: new Decimal(p.price),
        })),
      });
    }

    this.logger.log(`Product updated: ${id}`);
    return this.findOne(id);
  }

  async deactivate(id: string) {
    await this.findOne(id);

    await this.prisma.product.update({
      where: { id },
      data: { status: ProductStatus.INACTIVE },
    });

    this.logger.log(`Product deactivated: ${id}`);
    return { message: 'Product deactivated successfully' };
  }

  async remove(id: string, deletedBy: string, reason?: string) {
    const product = await this.findOne(id);

    // Store deleted product for record keeping
    await this.prisma.deletedProduct.create({
      data: {
        productId: product.id,
        sellerId: product.sellerId,
        name: product.name,
        description: product.description,
        imageUrl: product.imageUrl,
        images: product.images ?? undefined,
        category: product.category,
        brand: product.brand,
        prices: product.prices ?? undefined,
        deletedBy,
        reason,
        metadata: {
          sku: product.sku,
          stock: product.stock,
          rating: product.rating.toString(),
          totalReviews: product.totalReviews,
          createdAt: product.createdAt,
          updatedAt: product.updatedAt,
        },
      },
    });

    // Delete related data first
    await this.prisma.productPrice.deleteMany({
      where: { productId: id },
    });

    await this.prisma.favorite.deleteMany({
      where: { productId: id },
    });

    // Delete the product
    await this.prisma.product.delete({
      where: { id },
    });

    this.logger.log(`Product permanently deleted: ${id} by ${deletedBy}`);
    return { message: 'Product deleted successfully and moved to deleted items' };
  }

  async getCategories() {
    const categories = await this.prisma.product.findMany({
      where: { status: ProductStatus.ACTIVE },
      select: { category: true },
      distinct: ['category'],
    });

    return categories.map((p) => p.category).filter((c) => c !== null);
  }

  async searchProducts(query: string, filters?: { category?: string; country?: string }) {
    const where: any = {
      status: ProductStatus.ACTIVE,
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { category: { contains: query, mode: 'insensitive' } },
      ],
    };

    if (filters?.category) {
      where.category = filters.category;
    }

    // Filter by available countries (same logic as findAll)
    if (filters?.country) {
      // Show products that either:
      // 1. Are available worldwide (empty array)
      // 2. Include the requested country
      where.AND = [
        {
          OR: [
            { availableCountries: { equals: [] } },
            { availableCountries: { has: filters.country } },
          ],
        },
      ];
    } else {
      // When no country specified, only show worldwide products
      where.availableCountries = { equals: [] };
    }

    const products = await this.prisma.product.findMany({
      where,
      include: {
        prices: true,
        seller: {
          select: {
            id: true,
            companyName: true,
            tradingName: true,
            verifiedAt: true,
            rating: true,
            logo: true,
            isInhouse: true,
          },
        },
      },
      take: 20,
    });

    // Transform seller data and prices to match frontend expectations
    return products.map((product) => {
      const withPlatformPrices = this.transformProductPrices(product);
      return {
        ...withPlatformPrices,
        seller: product.seller
          ? {
              id: product.seller.id,
              name: product.seller.companyName,
              tradingName: product.seller.tradingName,
              isVerified: !!product.seller.verifiedAt,
              rating: product.seller.rating?.toString(),
              logo: product.seller.logo,
              isInhouse: product.seller.isInhouse,
            }
          : null,
      };
    });
  }

  // ==================== Product Variant Methods ====================

  async createVariant(createVariantDto: CreateProductVariantDto) {
    const { productId, priceAdjustment, ...variantData } = createVariantDto;

    // Verify product exists
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // If this is the first variant or isDefault is true, set as default
    const existingVariants = await this.prisma.productVariant.count({
      where: { productId },
    });

    const isFirstVariant = existingVariants === 0;

    // If setting as default, unset other defaults
    if (createVariantDto.isDefault || isFirstVariant) {
      await this.prisma.productVariant.updateMany({
        where: { productId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const variant = await this.prisma.productVariant.create({
      data: {
        ...variantData,
        productId,
        priceAdjustment: priceAdjustment
          ? new Decimal(priceAdjustment)
          : new Decimal(0),
        isDefault: createVariantDto.isDefault || isFirstVariant,
      },
    });

    // Update product to indicate it has variants
    await this.prisma.product.update({
      where: { id: productId },
      data: { hasVariants: true },
    });

    this.logger.log(`Variant created: ${variant.id} for product ${productId}`);
    return variant;
  }

  async updateVariant(id: string, updateVariantDto: UpdateProductVariantDto) {
    // Check if variant exists
    const existingVariant = await this.prisma.productVariant.findUnique({
      where: { id },
    });

    if (!existingVariant) {
      throw new NotFoundException('Product variant not found');
    }

    const { priceAdjustment, ...variantData } = updateVariantDto;

    // If setting as default, unset other defaults for the same product
    if (updateVariantDto.isDefault) {
      await this.prisma.productVariant.updateMany({
        where: {
          productId: existingVariant.productId,
          id: { not: id },
          isDefault: true,
        },
        data: { isDefault: false },
      });
    }

    const variant = await this.prisma.productVariant.update({
      where: { id },
      data: {
        ...variantData,
        ...(priceAdjustment && {
          priceAdjustment: new Decimal(priceAdjustment),
        }),
      },
    });

    this.logger.log(`Variant updated: ${id}`);
    return variant;
  }

  async deleteVariant(id: string) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id },
      include: { product: true },
    });

    if (!variant) {
      throw new NotFoundException('Product variant not found');
    }

    // Don't allow deleting the last variant if product has variants
    const variantCount = await this.prisma.productVariant.count({
      where: { productId: variant.productId },
    });

    await this.prisma.productVariant.delete({
      where: { id },
    });

    // If this was the last variant, update product hasVariants flag
    if (variantCount === 1) {
      await this.prisma.product.update({
        where: { id: variant.productId },
        data: { hasVariants: false },
      });
    } else if (variant.isDefault) {
      // If deleted variant was default, set another variant as default
      const firstVariant = await this.prisma.productVariant.findFirst({
        where: { productId: variant.productId },
      });

      if (firstVariant) {
        await this.prisma.productVariant.update({
          where: { id: firstVariant.id },
          data: { isDefault: true },
        });
      }
    }

    this.logger.log(`Variant deleted: ${id}`);
    return { message: 'Product variant deleted successfully' };
  }

  async getProductVariants(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const variants = await this.prisma.productVariant.findMany({
      where: { productId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });

    return variants;
  }

  async setDefaultVariant(variantId: string) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
    });

    if (!variant) {
      throw new NotFoundException('Product variant not found');
    }

    // Unset all other defaults for this product
    await this.prisma.productVariant.updateMany({
      where: {
        productId: variant.productId,
        id: { not: variantId },
        isDefault: true,
      },
      data: { isDefault: false },
    });

    // Set this variant as default
    await this.prisma.productVariant.update({
      where: { id: variantId },
      data: { isDefault: true },
    });

    this.logger.log(`Variant ${variantId} set as default`);
    return { message: 'Default variant updated successfully' };
  }
}
