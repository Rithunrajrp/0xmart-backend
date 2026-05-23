import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreateShopifyMerchantDto,
  CreateShopifyProductDto,
  UpdateShopifyProductDto,
  UpdateFulfillmentDto,
} from './dto';
import { Decimal } from '@prisma/client/runtime/library';
import { SellerType, SellerStatus, ProductStatus, StablecoinType } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ShopifyService {
  private readonly logger = new Logger(ShopifyService.name);
  private readonly COMMISSION_RATE = 0.20; // 20% commission

  constructor(private prisma: PrismaService) {}

  /**
   * Create a merchant account from Shopify store
   * This creates both a Seller and ShopifyStore record
   */
  async createMerchantFromShopify(dto: CreateShopifyMerchantDto) {
    // Check if store already exists
    const existingStore = await this.prisma.shopifyStore.findUnique({
      where: { shopDomain: dto.shopifyShop },
      include: { seller: true },
    });

    if (existingStore) {
      // Return existing store with credentials
      return {
        id: existingStore.seller?.id || existingStore.id,
        email: existingStore.shopEmail,
        storeName: existingStore.shopName,
        apiKey: existingStore.apiKey,
        apiSecret: existingStore.apiSecret,
        isNew: false,
      };
    }

    // Create seller and shopify store in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create seller account
      const seller = await tx.seller.create({
        data: {
          companyName: dto.storeName,
          tradingName: dto.storeName,
          email: dto.email,
          country: dto.country || 'US',
          sellerType: SellerType.INDIVIDUAL,
          status: SellerStatus.ACTIVE, // Auto-approve Shopify merchants
          verifiedAt: new Date(),
          commissionRate: new Decimal(this.COMMISSION_RATE),
        },
      });

      // Generate API credentials
      const apiKey = uuidv4();
      const apiSecret = uuidv4();

      // Create Shopify store record
      const shopifyStore = await tx.shopifyStore.create({
        data: {
          shopDomain: dto.shopifyShop,
          shopName: dto.storeName,
          shopEmail: dto.email,
          shopCurrency: dto.currency,
          shopCountry: dto.country,
          sellerId: seller.id,
          apiKey,
          apiSecret,
          isConnected: true,
          connectedAt: new Date(),
          commissionRate: new Decimal(this.COMMISSION_RATE),
        },
      });

      return { seller, shopifyStore, apiKey, apiSecret };
    });

    this.logger.log(
      `Created Shopify merchant: ${dto.storeName} (${dto.shopifyShop})`,
    );

    return {
      id: result.seller.id,
      email: dto.email,
      storeName: dto.storeName,
      apiKey: result.apiKey,
      apiSecret: result.apiSecret,
      isNew: true,
    };
  }

  /**
   * Get merchant by Shopify shop domain
   */
  async getMerchantByShop(shopDomain: string) {
    const store = await this.prisma.shopifyStore.findUnique({
      where: { shopDomain },
      include: { seller: true },
    });

    if (!store) {
      throw new NotFoundException(`Store not found: ${shopDomain}`);
    }

    return {
      id: store.seller?.id || store.id,
      email: store.shopEmail,
      storeName: store.shopName,
      apiKey: store.apiKey,
    };
  }

  /**
   * Validate API key for Shopify store
   */
  async validateApiKey(apiKey: string) {
    const store = await this.prisma.shopifyStore.findUnique({
      where: { apiKey },
      include: { seller: true },
    });

    if (!store || !store.isConnected) {
      return null;
    }

    return store;
  }

  /**
   * Create a product from Shopify sync
   */
  async createProduct(storeApiKey: string, dto: CreateShopifyProductDto) {
    const store = await this.validateApiKey(storeApiKey);
    if (!store || !store.sellerId) {
      throw new BadRequestException('Invalid API key or store not connected');
    }

    // Check if product already exists
    const existingProduct = await this.prisma.shopifyProduct.findUnique({
      where: {
        shopifyStoreId_shopifyProductId: {
          shopifyStoreId: store.id,
          shopifyProductId: dto.shopifyProductId,
        },
      },
    });

    if (existingProduct?.oxmartProductId) {
      throw new ConflictException('Product already synced');
    }

    // Create product in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create 0xMart product
      const product = await tx.product.create({
        data: {
          name: dto.title,
          description: dto.description,
          imageUrl: dto.imageUrl,
          status: ProductStatus.ACTIVE,
          stock: dto.inventory || 0,
          sellerId: store.sellerId!,
          metadata: {
            shopifyProductId: dto.shopifyProductId,
            shopifyVariantId: dto.shopifyVariantId,
            source: 'shopify',
          },
          prices: {
            create: {
              stablecoinType: StablecoinType.USDT,
              price: new Decimal(dto.priceUsdt),
            },
          },
        },
        include: {
          prices: true,
        },
      });

      // Create or update Shopify product mapping
      const shopifyProduct = await tx.shopifyProduct.upsert({
        where: {
          shopifyStoreId_shopifyProductId: {
            shopifyStoreId: store.id,
            shopifyProductId: dto.shopifyProductId,
          },
        },
        create: {
          shopifyStoreId: store.id,
          shopifyProductId: dto.shopifyProductId,
          shopifyVariantId: dto.shopifyVariantId,
          shopifyHandle: dto.shopifyProductId.split('/').pop() || '',
          title: dto.title,
          description: dto.description,
          originalPrice: new Decimal(dto.priceUsdt / (1 + this.COMMISSION_RATE)), // Original without commission
          originalCurrency: store.shopCurrency,
          imageUrl: dto.imageUrl,
          oxmartProductId: product.id,
          priceUsdt: new Decimal(dto.priceUsdt),
          isSelected: true,
          isSynced: true,
          lastSyncedAt: new Date(),
        },
        update: {
          title: dto.title,
          description: dto.description,
          imageUrl: dto.imageUrl,
          oxmartProductId: product.id,
          priceUsdt: new Decimal(dto.priceUsdt),
          isSynced: true,
          lastSyncedAt: new Date(),
          syncError: null,
        },
      });

      return { product, shopifyProduct };
    });

    this.logger.log(
      `Created product from Shopify: ${dto.title} (${result.product.id})`,
    );

    return {
      id: result.product.id,
      title: result.product.name,
      description: result.product.description,
      price: result.product.prices[0]?.price,
      currency: 'USDT',
      imageUrl: result.product.imageUrl,
      merchantId: store.sellerId,
      externalId: dto.shopifyProductId,
      externalSource: 'shopify',
    };
  }

  /**
   * Update a product from Shopify sync
   */
  async updateProduct(
    storeApiKey: string,
    productId: string,
    dto: UpdateShopifyProductDto,
  ) {
    const store = await this.validateApiKey(storeApiKey);
    if (!store) {
      throw new BadRequestException('Invalid API key');
    }

    // Find the product
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { prices: true, shopifyProduct: true },
    });

    if (!product) {
      throw new NotFoundException(`Product not found: ${productId}`);
    }

    // Update product
    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedProduct = await tx.product.update({
        where: { id: productId },
        data: {
          name: dto.title ?? product.name,
          description: dto.description ?? product.description,
          imageUrl: dto.imageUrl ?? product.imageUrl,
          stock: dto.inventory ?? product.stock,
          status: dto.isActive === false ? ProductStatus.INACTIVE : product.status,
        },
        include: { prices: true },
      });

      // Update price if provided
      if (dto.priceUsdt !== undefined) {
        await tx.productPrice.updateMany({
          where: {
            productId,
            stablecoinType: StablecoinType.USDT,
          },
          data: {
            price: new Decimal(dto.priceUsdt),
          },
        });
      }

      // Update Shopify product mapping if exists
      if (product.shopifyProduct) {
        await tx.shopifyProduct.update({
          where: { id: product.shopifyProduct.id },
          data: {
            title: dto.title ?? product.shopifyProduct.title,
            description: dto.description ?? product.shopifyProduct.description,
            imageUrl: dto.imageUrl ?? product.shopifyProduct.imageUrl,
            priceUsdt: dto.priceUsdt
              ? new Decimal(dto.priceUsdt)
              : product.shopifyProduct.priceUsdt,
            lastSyncedAt: new Date(),
          },
        });
      }

      return updatedProduct;
    });

    this.logger.log(`Updated product from Shopify: ${productId}`);

    return {
      id: updated.id,
      title: updated.name,
      description: updated.description,
      price: dto.priceUsdt ?? updated.prices[0]?.price,
      currency: 'USDT',
      imageUrl: updated.imageUrl,
    };
  }

  /**
   * Delete a product (Shopify unlink)
   */
  async deleteProduct(storeApiKey: string, productId: string) {
    const store = await this.validateApiKey(storeApiKey);
    if (!store) {
      throw new BadRequestException('Invalid API key');
    }

    // Find the product
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { shopifyProduct: true },
    });

    if (!product) {
      throw new NotFoundException(`Product not found: ${productId}`);
    }

    // Delete Shopify product mapping and deactivate product
    await this.prisma.$transaction(async (tx) => {
      // Delete Shopify mapping
      if (product.shopifyProduct) {
        await tx.shopifyProduct.delete({
          where: { id: product.shopifyProduct.id },
        });
      }

      // Deactivate the product instead of deleting
      await tx.product.update({
        where: { id: productId },
        data: {
          status: ProductStatus.INACTIVE,
        },
      });
    });

    this.logger.log(`Deleted product from Shopify sync: ${productId}`);
  }

  /**
   * Get orders for a merchant that need fulfillment
   */
  async getOrdersForMerchant(
    storeApiKey: string,
    merchantId: string,
    status?: string,
  ) {
    const store = await this.validateApiKey(storeApiKey);
    if (!store || store.sellerId !== merchantId) {
      throw new BadRequestException('Invalid API key or merchant ID mismatch');
    }

    // Get orders with items from this merchant's products
    const orders = await this.prisma.order.findMany({
      where: {
        items: {
          some: {
            product: {
              sellerId: merchantId,
            },
          },
        },
        ...(status && { status: status as any }),
      },
      include: {
        items: {
          where: {
            product: {
              sellerId: merchantId,
            },
          },
          include: {
            product: {
              include: {
                shopifyProduct: true,
              },
            },
          },
        },
        user: {
          select: {
            email: true,
            phoneNumber: true,
          },
        },
        shippingAddr: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paidAt ? 'COMPLETED' : 'PENDING',
      totalUsdt: order.total,
      customerEmail: order.user.email,
      customerName: order.shippingAddr?.fullName || '',
      shippingAddress: order.shippingAddr
        ? {
            address1: order.shippingAddr.addressLine1,
            address2: order.shippingAddr.addressLine2,
            city: order.shippingAddr.city,
            province: order.shippingAddr.state,
            country: order.shippingAddr.country,
            zip: order.shippingAddr.postalCode,
            phone: order.shippingAddr.phone,
          }
        : order.shippingAddress,
      items: order.items.map((item) => ({
        productId: item.productId,
        shopifyProductId: item.product.shopifyProduct?.shopifyProductId,
        shopifyVariantId: item.product.shopifyProduct?.shopifyVariantId,
        quantity: item.quantity,
        priceUsdt: item.pricePerUnit,
      })),
      createdAt: order.createdAt.toISOString(),
    }));
  }

  /**
   * Update order fulfillment status from Shopify
   */
  async updateOrderFulfillment(
    storeApiKey: string,
    orderId: string,
    dto: UpdateFulfillmentDto,
  ) {
    const store = await this.validateApiKey(storeApiKey);
    if (!store) {
      throw new BadRequestException('Invalid API key');
    }

    // Find the order
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order not found: ${orderId}`);
    }

    // Update order status
    const statusMap: Record<string, string> = {
      FULFILLED: 'SHIPPED',
      PARTIALLY_FULFILLED: 'PROCESSING',
      UNFULFILLED: 'PENDING',
    };

    const newStatus = statusMap[dto.fulfillmentStatus] || order.status;

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: newStatus as any,
        trackingNumber: dto.trackingNumber ?? order.trackingNumber,
        shippedAt:
          dto.fulfillmentStatus === 'FULFILLED' ? new Date() : order.shippedAt,
        metadata: {
          ...(order.metadata as any),
          shopifyFulfillment: {
            status: dto.fulfillmentStatus,
            trackingNumber: dto.trackingNumber,
            trackingUrl: dto.trackingUrl,
            updatedAt: new Date().toISOString(),
          },
        },
      },
    });

    this.logger.log(
      `Updated order fulfillment: ${orderId} -> ${dto.fulfillmentStatus}`,
    );
  }
}
