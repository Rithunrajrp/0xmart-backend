import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { UpdateMerchantProfileDto } from './dto/update-merchant-profile.dto';
import { UploadMerchantDocumentDto } from './dto/upload-merchant-document.dto';
import { CreateMerchantProductDto } from './dto/create-product.dto';
import { UpdateMerchantProductDto } from './dto/update-product.dto';

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

    const formattedOrders = orders.map((order) => {
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

    return {
      orders: formattedOrders,
      total: formattedOrders.length,
    };
  }

  async getMerchantProducts(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ) {
    // Find the seller linked to this user
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
    });

    if (!seller) {
      throw new NotFoundException('Merchant profile not found for this user');
    }

    const skip = (page - 1) * limit;

    // Get products for this seller
    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where: {
          sellerId: seller.id,
        },
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          prices: true,
        },
        skip,
        take: limit,
      }),
      this.prisma.product.count({
        where: {
          sellerId: seller.id,
        },
      }),
    ]);

    // Map stablecoinType to currency for frontend compatibility
    const mappedProducts = products.map((product) => ({
      ...product,
      prices: product.prices.map((p) => ({
        ...p,
        currency: p.stablecoinType,
        stablecoinType: undefined, // Optional: remove internal name
      })),
    }));

    return {
      products: mappedProducts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async createMerchantProduct(userId: string, createProductDto: CreateMerchantProductDto) {
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
    });

    if (!seller) {
      throw new NotFoundException('Merchant profile not found for this user');
    }

    try {
      const product = await this.prisma.product.create({
        data: {
          sellerId: seller.id,
          name: createProductDto.name,
          description: createProductDto.description,
          shortDescription: createProductDto.shortDescription,
          category: createProductDto.category,
          brand: createProductDto.brand,
          sku: createProductDto.sku,
          stock: createProductDto.stock,
          isDigital: createProductDto.isDigital,
          status: 'ACTIVE',
          images: createProductDto.images || [],
          prices: {
            create: createProductDto.prices.map((p) => ({
              stablecoinType: p.currency as any, // Map currency to stablecoinType
              price: new Decimal(p.price),
            })),
          },
        },
        include: {
          prices: true,
        },
      });

      return product;
    } catch (error) {
      console.error('Create Product Error:', error);
      throw new BadRequestException(`Failed to create product: ${error.message}`);
    }
  }

  async updateMerchantProduct(userId: string, productId: string, updateProductDto: UpdateMerchantProductDto) {
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
    });

    if (!seller) {
      throw new NotFoundException('Merchant profile not found for this user');
    }

    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        sellerId: seller.id,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found or access denied');
    }

    let pricesUpdate = {};
    if (updateProductDto.prices) {
      // For simplicity, delete and recreate
      await this.prisma.productPrice.deleteMany({
        where: { productId: product.id },
      });

      pricesUpdate = {
        prices: {
          create: updateProductDto.prices.map((p) => ({
            stablecoinType: p.currency as any,
            price: new Decimal(p.price),
          })),
        },
      };
    }

    const { prices, status, ...productData } = updateProductDto;

    const updatedProduct = await this.prisma.product.update({
      where: { id: productId },
      data: {
        ...productData,
        status: status as any, // Cast string to Enum
        ...pricesUpdate,
      },
      include: {
        prices: true,
      },
    });

    return updatedProduct;
  }

  async deleteMerchantProduct(userId: string, productId: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
    });

    if (!seller) {
      throw new NotFoundException('Merchant profile not found for this user');
    }

    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        sellerId: seller.id,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found or access denied');
    }

    await this.prisma.product.delete({
      where: { id: productId },
    });

    return { message: 'Product deleted successfully' };
  }

  /**
   * Get merchant profile with full details including status
   */
  async getMerchantProfile(userId: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
      select: {
        id: true,
        companyName: true,
        tradingName: true,
        sellerType: true,
        email: true,
        phone: true,
        website: true,
        description: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        state: true,
        postalCode: true,
        country: true,
        registrationNumber: true,
        taxId: true,
        logo: true,
        banner: true,
        status: true,
        rating: true,
        totalReviews: true,
        totalSales: true,
        documentsSubmittedAt: true,
        approvedAt: true,
        activatedAt: true,
        rejectionReason: true,
        createdAt: true,
      },
    });

    if (!seller) {
      throw new NotFoundException('Merchant profile not found for this user');
    }

    return {
      ...seller,
      rating: seller.rating.toString(),
    };
  }

  /**
   * Update merchant profile with company details and change status to DOCUMENTS_PENDING
   */
  async updateMerchantProfile(userId: string, updateDto: UpdateMerchantProfileDto) {
    // Find seller by userId
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
    });

    if (!seller) {
      throw new NotFoundException('Merchant profile not found for this user');
    }

    // Only allow update if status is PENDING_VERIFICATION or DOCUMENTS_PENDING
    if (seller.status !== 'PENDING_VERIFICATION' && seller.status !== 'DOCUMENTS_PENDING') {
      throw new BadRequestException(
        `Cannot update profile in ${seller.status} status. Profile can only be updated during onboarding.`
      );
    }

    // Update seller with new details and change status to DOCUMENTS_PENDING
    const updatedSeller = await this.prisma.seller.update({
      where: { id: seller.id },
      data: {
        companyName: updateDto.companyName,
        tradingName: updateDto.tradingName,
        sellerType: updateDto.sellerType as any,
        phone: updateDto.phone,
        website: updateDto.website,
        logo: updateDto.logo,
        banner: updateDto.banner,
        addressLine1: updateDto.addressLine1,
        addressLine2: updateDto.addressLine2,
        city: updateDto.city,
        state: updateDto.state,
        postalCode: updateDto.postalCode,
        country: updateDto.country,
        registrationNumber: updateDto.registrationNumber,
        taxId: updateDto.taxId,
        description: updateDto.description,
        status: 'DOCUMENTS_PENDING',
      },
    });

    return {
      message: 'Merchant profile updated successfully',
      status: updatedSeller.status,
    };
  }

  /**
   * Update online presence (website, logo, banner) - allowed for all active merchants
   */
  async updateOnlinePresence(userId: string, data: { website?: string; logo?: string; banner?: string }) {
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
    });

    if (!seller) {
      throw new NotFoundException('Merchant profile not found for this user');
    }

    const updatedSeller = await this.prisma.seller.update({
      where: { id: seller.id },
      data: {
        website: data.website,
        logo: data.logo,
        banner: data.banner,
      },
      select: {
        id: true,
        website: true,
        logo: true,
        banner: true,
      },
    });

    return updatedSeller;
  }

  /**
   * Get merchant uploaded documents
   */
  async getMerchantDocuments(userId: string) {
    // Find seller by userId with documents
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
      include: {
        sellerDocuments: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!seller) {
      throw new NotFoundException('Merchant profile not found for this user');
    }

    return seller.sellerDocuments;
  }

  /**
   * Upload a document for merchant onboarding
   */
  async uploadMerchantDocument(userId: string, uploadDto: UploadMerchantDocumentDto) {
    // Find seller by userId
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
    });

    if (!seller) {
      throw new NotFoundException('Merchant profile not found for this user');
    }

    // Only allow upload if status is DOCUMENTS_PENDING
    if (seller.status !== 'DOCUMENTS_PENDING') {
      throw new BadRequestException(
        `Cannot upload documents in ${seller.status} status. Please complete company details first.`
      );
    }

    // Check if document of this type already exists and delete it
    await this.prisma.sellerDocument.deleteMany({
      where: {
        sellerId: seller.id,
        documentType: uploadDto.documentType,
      },
    });

    // Create new document record
    const document = await this.prisma.sellerDocument.create({
      data: {
        sellerId: seller.id,
        documentType: uploadDto.documentType,
        fileName: uploadDto.fileName,
        documentUrl: uploadDto.documentUrl,
        mimeType: uploadDto.mimeType,
        fileSize: uploadDto.fileSize,
        status: 'PENDING',
      },
    });

    return {
      message: 'Document uploaded successfully',
      documentId: document.id,
      documentType: document.documentType,
    };
  }

  /**
   * Submit all documents for review and change status to UNDER_REVIEW
   */
  async submitMerchantDocuments(userId: string) {
    // Find seller by userId with documents
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
      include: {
        sellerDocuments: true,
      },
    });

    if (!seller) {
      throw new NotFoundException('Merchant profile not found for this user');
    }

    // Only allow submit if status is DOCUMENTS_PENDING
    if (seller.status !== 'DOCUMENTS_PENDING') {
      throw new BadRequestException(
        `Cannot submit documents in ${seller.status} status.`
      );
    }

    // Check if all required documents are uploaded
    const requiredDocuments = ['business_license', 'tax_certificate', 'identity_proof', 'bank_statement'];
    const uploadedDocumentTypes = seller.sellerDocuments.map(doc => doc.documentType);
    const missingDocuments = requiredDocuments.filter(type => !uploadedDocumentTypes.includes(type));

    if (missingDocuments.length > 0) {
      throw new BadRequestException(
        `Missing required documents: ${missingDocuments.join(', ')}`
      );
    }

    // Update seller status to UNDER_REVIEW
    const updatedSeller = await this.prisma.seller.update({
      where: { id: seller.id },
      data: {
        status: 'UNDER_REVIEW',
        documentsSubmittedAt: new Date(),
      },
    });

    return {
      message: 'Documents submitted for review successfully',
      status: updatedSeller.status,
      documentsCount: seller.sellerDocuments.length,
    };
  }
}
