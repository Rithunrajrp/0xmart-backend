import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(private prisma: PrismaService) {}

  async create(createProductDto: CreateProductDto) {
    const { prices, sellerId, ...productData } = createProductDto;

    const product = await this.prisma.product.create({
      data: {
        ...productData,
        status: ProductStatus.ACTIVE,
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
    page?: number;
    limit?: number;
  }) {
    const { status, category, page = 1, limit = 20 } = filters || {};
    const skip = (page - 1) * limit;

    const where: any = {};

    if (status) where.status = status;

    if (category) where.category = category;

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        include: {
          prices: true,
        },
        orderBy: { createdAt: 'desc' },
      }),

      this.prisma.product.count({ where }),
    ]);

    return {
      products,
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
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
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

  async searchProducts(query: string, filters?: { category?: string }) {
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

    return this.prisma.product.findMany({
      where,
      include: {
        prices: true,
      },
      take: 20,
    });
  }
}
