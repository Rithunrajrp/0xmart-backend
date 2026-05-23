import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ChatCompletionTool } from 'openai/resources/chat';
import { ProductsService } from '../products/products.service';
import { OrdersService } from '../orders/orders.service';
import { WalletsService } from '../wallets/wallets.service';
import { UserAddressesService } from '../users/user-addresses.service';
import { z } from 'zod';
import {
  ToolResult,
  ProductEntity,
  WalletEntity,
  UserAddressEntity,
  CreateOrderDto,
  OrderEntity,
  SearchProductsArgs,
  GetProductDetailsArgs,
  PlaceOrderArgs,
  InitiateDepositPaymentArgs,
  InitiateSmartContractPaymentArgs,
  ChatProductResponse,
  ChatWalletResponse,
  ChatAddressResponse,
  ProductPriceEntity,
} from './types/tool.types';

// Re-export ToolResult for use in other modules
export type { ToolResult } from './types/tool.types';

@Injectable()
export class ToolRegistryService {
  private readonly logger = new Logger(ToolRegistryService.name);

  constructor(
    private productsService: ProductsService,
    private ordersService: OrdersService,
    private walletsService: WalletsService,
    private addressesService: UserAddressesService,
  ) {}

  // ─── Validation schemas ───────────────────────────────────────

  private searchProductsSchema = z.object({
    query: z.string().min(1).max(200),
    limit: z.number().int().positive().max(100).optional(),
    minPrice: z.number().nonnegative().optional(),
    maxPrice: z.number().positive().optional(),
    category: z.string().max(100).optional(),
  });

  private placeOrderSchema = z.object({
    stablecoin: z.enum(['USDT', 'USDC']),
    shippingAddressId: z.string().uuid(),
    items: z.array(z.object({
      productId: z.string().uuid(),
      quantity: z.number().int().positive().max(1000),
    })).min(1).max(50),
  });

  private getProductSchema = z.object({
    productId: z.string().uuid(),
  });

  // ─── Tool definitions ─────────────────────────────────────────

  getTools(): ChatCompletionTool[] {
    return [
      // ── Product tools ──
      {
        type: 'function',
        function: {
          name: 'search_products',
          description:
            'Search the 0xMart product catalog by keyword and/or category. ' +
            'Use this to find products before adding them to cart. ' +
            'Returns a list of matching products with IDs, names, and prices. ' +
            'Always search before adding to cart — never guess a product ID. ' +
            'IMPORTANT: When user asks "what X do you have" (e.g. "what food do you have"), use the category name as the query (e.g. query="food"). ' +
            'The search will find products by name, description, OR category.',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query: product name, description, or category (e.g. "mayo", "wireless keyboard", "food", "beverage")',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of products to return (default: 6, recommended: 3-6 for chat display)',
                default: 6,
              },
              minPrice: {
                type: 'number',
                description: 'Minimum price in USDT',
              },
              maxPrice: {
                type: 'number',
                description: 'Maximum price in USDT',
              },
              category: {
                type: 'string',
                description: 'Product category filter (case-insensitive). Use this to narrow results to a specific category.',
              },
            },
            required: ['query'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_product_details',
          description:
            'Get full details of a single product including description, specifications, stock, and price.',
          parameters: {
            type: 'object',
            properties: {
              productId: {
                type: 'string',
                description: 'The product ID from a previous search_products result',
              },
            },
            required: ['productId'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_categories',
          description: 'Get all available product categories on the platform.',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      },

      // ── Cart tools ──
      {
        type: 'function',
        function: {
          name: 'add_to_cart',
          description:
            'Add a product to the user\'s shopping cart. ' +
            'The productId MUST come from a previous search_products or get_product_details result. ' +
            'Tell the user what you are adding before calling this.',
          parameters: {
            type: 'object',
            properties: {
              productId: {
                type: 'string',
                description: 'Product ID from a previous search result',
              },
              quantity: {
                type: 'number',
                description: 'Number of units to add (default: 1)',
                default: 1,
              },
            },
            required: ['productId'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'remove_from_cart',
          description: 'Remove a product from the user\'s cart by product ID.',
          parameters: {
            type: 'object',
            properties: {
              productId: {
                type: 'string',
                description: 'Product ID to remove',
              },
            },
            required: ['productId'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_cart',
          description:
            'Get the current contents of the user\'s cart including items, quantities, and total price. ' +
            'Call this before summarizing the cart or placing an order.',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      },

      // ── Order & address tools ──
      {
        type: 'function',
        function: {
          name: 'get_user_addresses',
          description:
            'Retrieve the user\'s saved shipping and billing addresses. ' +
            'Call this when the user wants to place an order so you can ask them which address to ship to.',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'place_order',
          description:
            'Place an order using the current cart contents. ' +
            'CONFIRMATION GATE — this tool will only execute after the user explicitly confirms. ' +
            'Before calling this, summarize the cart and ask for confirmation.',
          parameters: {
            type: 'object',
            properties: {
              shippingAddressId: {
                type: 'string',
                description: 'ID of the shipping address from get_user_addresses',
              },
              stablecoin: {
                type: 'string',
                description: 'Payment stablecoin: USDT, USDC, DAI, or BUSD',
              },
            },
            required: ['shippingAddressId', 'stablecoin'],
          },
        },
      },

      // ── Payment & wallet tools ──
      {
        type: 'function',
        function: {
          name: 'get_payment_options',
          description:
            'Get the user\'s available payment options: wallet balances, supported networks and stablecoins. ' +
            'Call this before asking the user how they want to pay.',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_user_wallets',
          description:
            'Get the user\'s wallets and current balances across all supported blockchain networks.',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'initiate_deposit_payment',
          description:
            'Initiate payment by generating a deposit address the user must send funds to. ' +
            'CONFIRMATION GATE — only call after user confirmation. ' +
            'Returns the deposit address and instructions.',
          parameters: {
            type: 'object',
            properties: {
              orderId: {
                type: 'string',
                description: 'The order ID from place_order',
              },
              networkId: {
                type: 'string',
                description: 'Network: ETHEREUM, POLYGON, BSC, ARBITRUM, OPTIMISM, AVALANCHE, BASE, SUI',
              },
              stablecoin: {
                type: 'string',
                description: 'Stablecoin: USDT, USDC, DAI, or BUSD',
              },
            },
            required: ['orderId', 'networkId', 'stablecoin'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'initiate_smart_contract_payment',
          description:
            'Initiate payment via smart contract. ' +
            'CONFIRMATION GATE — only call after user confirmation. ' +
            'Returns contract parameters for the frontend to execute.',
          parameters: {
            type: 'object',
            properties: {
              orderId: {
                type: 'string',
                description: 'The order ID from place_order',
              },
              networkId: {
                type: 'string',
                description: 'Network: ETHEREUM, POLYGON, BSC, ARBITRUM, OPTIMISM, AVALANCHE, BASE',
              },
              stablecoin: {
                type: 'string',
                description: 'Stablecoin: USDT, USDC, DAI, or BUSD',
              },
            },
            required: ['orderId', 'networkId', 'stablecoin'],
          },
        },
      },
    ];
  }

  // ─── Execution ────────────────────────────────────────────────

  async executeTool(
    toolName: string,
    args: Record<string, any>,
    userId?: string,
  ): Promise<ToolResult> {
    try {
      this.logger.debug(`Executing tool: ${toolName} with args: ${JSON.stringify(args)}`);

      switch (toolName) {
        // Product tools
        case 'search_products':
          return await this.searchProducts(args as SearchProductsArgs);
        case 'get_product_details':
          return await this.getProductDetails(args as GetProductDetailsArgs);
        case 'get_categories':
          return await this.getCategories();

        // Cart tools are handled in ChatAgentService (session-scoped cart).
        // They should not reach here, but guard just in case.
        case 'add_to_cart':
        case 'remove_from_cart':
        case 'get_cart':
          return { success: false, error: `${toolName} must be handled by the agent` };

        // Order & address tools
        case 'get_user_addresses':
          return await this.getUserAddresses(userId);
        case 'place_order':
          return await this.placeOrder(args as PlaceOrderArgs, userId);

        // Payment & wallet tools
        case 'get_payment_options':
          return await this.getPaymentOptions(userId);
        case 'get_user_wallets':
          return await this.getUserWallets(userId);
        case 'initiate_deposit_payment':
          return await this.initiateDepositPayment(args as InitiateDepositPaymentArgs, userId);
        case 'initiate_smart_contract_payment':
          return await this.initiateSmartContractPayment(args as InitiateSmartContractPaymentArgs);

        default:
          return { success: false, error: `Unknown tool: ${toolName}` };
      }
    } catch (error) {
      this.logger.error(`Tool execution error: ${error.message}`, error.stack);
      return {
        success: false,
        error: `Failed to execute ${toolName}: ${error.message}`,
      };
    }
  }

  /**
   * Fetch a product by ID — used by ChatAgentService to validate
   * products before adding to cart.
   */
  async getProductById(productId: string): Promise<ProductEntity> {
    return this.productsService.findOne(productId) as Promise<ProductEntity>;
  }

  // ─── Product tools ────────────────────────────────────────────

  private async searchProducts(args: SearchProductsArgs): Promise<ToolResult> {
    try {
      // Validate input
      const validatedArgs = this.searchProductsSchema.parse(args);

      const allProducts = await this.productsService.searchProducts(
        validatedArgs.query,
        { category: validatedArgs.category },
      ) as ProductEntity[];

      let filteredProducts = allProducts;

      if (args.minPrice !== undefined || args.maxPrice !== undefined) {
        filteredProducts = filteredProducts.filter((p: ProductEntity) => {
          // Extract price from prices array (platform price with markup)
          const firstPrice = p.prices?.[0];
          const price = parseFloat(firstPrice?.price?.toString() || '0');
          if (args.minPrice !== undefined && price < args.minPrice) return false;
          if (args.maxPrice !== undefined && price > args.maxPrice) return false;
          return true;
        });
      }

      const products = filteredProducts.slice(0, args.limit || 6);

      return {
        success: true,
        data: {
          count: products.length,
          products: products.map((p: ProductEntity): ChatProductResponse => {
            // Extract first NON-ZERO price from prices array and add 20% markup
            let merchantPrice = 0;
            let currency = 'USDT';

            if (p.prices && Array.isArray(p.prices) && p.prices.length > 0) {
              const validPrice = p.prices.find((price: ProductPriceEntity) => {
                const val = parseFloat(price.price?.toString() || '0');
                return val > 0;
              });

              if (validPrice) {
                merchantPrice = parseFloat(validPrice.price.toString());
                currency = validPrice.stablecoinType || 'USDT';
              }
            }

            // Apply 20% markup for customer-facing price
            const customerPrice = merchantPrice > 0 ? merchantPrice * 1.20 : 0;

            // Debug logging
            if (customerPrice === 0 && p.name.toLowerCase().includes('lip')) {
              this.logger.warn(`Price debug for ${p.name}: merchantPrice=${merchantPrice}, customerPrice=${customerPrice}, prices=${JSON.stringify(p.prices)}`);
            }

            return {
              id: p.id,
              name: p.name,
              description: p.description,
              price: customerPrice > 0 ? customerPrice : null,
              priceDisplay: customerPrice > 0 ? `$${customerPrice.toFixed(2)} ${currency}` : 'Price available on checkout',
              currency: currency,
              category: p.category,
              // SECURITY: Do NOT include images (contains S3 URLs)
              inStock: p.stock > 0,
              stock: p.stock,
              rating: parseFloat(p.rating?.toString() || '0'),
              reviews: p.totalReviews || 0,
            };
          }),
        },
      };
    } catch (error) {
      this.logger.error(`Search products error: ${error.message}`);
      return { success: false, error: `Failed to search products: ${error.message}` };
    }
  }

  private async getProductDetails(args: GetProductDetailsArgs): Promise<ToolResult> {
    try {
      const product = await this.productsService.findOne(args.productId) as ProductEntity;

      if (!product) {
        return { success: false, error: 'Product not found' };
      }

      // Extract first NON-ZERO price from prices array and add 20% markup
      let merchantPrice = 0;
      let currency = 'USDT';

      if (product.prices && Array.isArray(product.prices) && product.prices.length > 0) {
        const validPrice = product.prices.find((price: ProductPriceEntity) => {
          const val = parseFloat(price.price?.toString() || '0');
          return val > 0;
        });

        if (validPrice) {
          merchantPrice = parseFloat(validPrice.price.toString());
          currency = validPrice.stablecoinType || 'USDT';
        }
      }

      // Apply 20% markup for customer-facing price
      const customerPrice = merchantPrice > 0 ? merchantPrice * 1.20 : 0;

      return {
        success: true,
        data: {
          id: product.id,
          name: product.name,
          description: product.description,
          longDescription: product.longDescription,
          price: customerPrice > 0 ? customerPrice : null,
          priceDisplay: customerPrice > 0 ? `$${customerPrice.toFixed(2)} ${currency}` : 'Price available on checkout',
          currency: currency,
          category: product.category,
          // SECURITY: Do NOT include images (contains S3 URLs)
          inStock: product.stock > 0,
          stock: product.stock,
          rating: product.rating || 0,
          reviews: product.reviewCount || 0,
          specifications: product.specifications,
          sellerName: product.seller?.businessName || 'Unknown',
          // SECURITY: Do NOT include full seller object (may contain sensitive data)
        },
      };
    } catch (error) {
      this.logger.error(`Get product details error: ${error.message}`);
      return { success: false, error: `Failed to get product details: ${error.message}` };
    }
  }

  private async getCategories(): Promise<ToolResult> {
    try {
      const categories = await this.productsService.getCategories();
      return { success: true, data: { categories } };
    } catch (error) {
      this.logger.error(`Get categories error: ${error.message}`);
      return { success: false, error: `Failed to get categories: ${error.message}` };
    }
  }

  // ─── Address & order tools ────────────────────────────────────

  private async getUserAddresses(userId: string | undefined): Promise<ToolResult> {
    if (!userId) return { success: false, error: 'Authentication required' };

    try {
      const addresses = await this.addressesService.findAll(userId) as UserAddressEntity[];

      return {
        success: true,
        data: {
          addresses: addresses.map((a: UserAddressEntity): ChatAddressResponse => ({
            id: a.id,
            type: a.type,
            fullName: a.fullName,
            street: a.addressLine1,
            city: a.city,
            state: a.state,
            postalCode: a.postalCode,
            country: a.country,
            phone: a.phone,
            isDefault: a.isDefault,
          })),
        },
      };
    } catch (error) {
      this.logger.error(`Get user addresses error: ${error.message}`);
      return { success: false, error: `Failed to get addresses: ${error.message}` };
    }
  }

  /**
   * Place an order. Receives `items` injected by ChatAgentService from the
   * session cart, plus `shippingAddressId` and `stablecoin` from GPT-4.
   */
  private async placeOrder(
    args: PlaceOrderArgs,
    userId: string | undefined,
  ): Promise<ToolResult> {
    if (!userId) return { success: false, error: 'Authentication required' };

    try {
      // Validate input
      const validatedArgs = this.placeOrderSchema.parse(args);

      if (validatedArgs.items.length === 0) {
        return { success: false, error: 'Cart is empty' };
      }

      // Fetch the shipping address to build the DTO
      const address = await this.addressesService.findOne(userId, validatedArgs.shippingAddressId) as UserAddressEntity;

      const createOrderDto: CreateOrderDto = {
        stablecoinType: validatedArgs.stablecoin,
        items: validatedArgs.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        shippingAddress: {
          name: address.fullName,
          street: address.addressLine1,
          city: address.city,
          state: address.state || '',
          zipCode: address.postalCode,
          country: address.country,
          phone: address.phone,
        },
      };

      const order = await this.ordersService.create(userId, createOrderDto) as OrderEntity;

      return {
        success: true,
        data: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          total: order.totalAmount?.toString(),
          status: order.status,
        },
      };
    } catch (error) {
      this.logger.error(`Place order error: ${error.message}`);
      return { success: false, error: `Failed to place order: ${error.message}` };
    }
  }

  // ─── Wallet & payment tools ───────────────────────────────────

  private async getUserWallets(userId: string | undefined): Promise<ToolResult> {
    if (!userId) return { success: false, error: 'Authentication required' };

    try {
      const wallets = await this.walletsService.getUserWallets(userId) as WalletEntity[];

      return {
        success: true,
        data: {
          wallets: wallets.map((w: WalletEntity): ChatWalletResponse => ({
            id: w.id,
            network: w.network,
            stablecoin: w.stablecoinType,
            depositAddress: w.depositAddress,
            balance: w.balance?.toString() || '0',
            lockedBalance: w.lockedBalance?.toString() || '0',
          })),
        },
      };
    } catch (error) {
      this.logger.error(`Get user wallets error: ${error.message}`);
      return { success: false, error: `Failed to get wallets: ${error.message}` };
    }
  }

  private async getPaymentOptions(userId: string | undefined): Promise<ToolResult> {
    if (!userId) return { success: false, error: 'Authentication required' };

    try {
      const wallets = await this.walletsService.getUserWallets(userId) as WalletEntity[];

      return {
        success: true,
        data: {
          wallets: wallets.map((w: WalletEntity) => ({
            network: w.network,
            stablecoin: w.stablecoinType,
            balance: w.balance?.toString() || '0',
            available: Number(w.balance || 0) > Number(w.lockedBalance || 0),
          })),
          supportedStablecoins: ['USDT', 'USDC', 'DAI', 'BUSD'],
          supportedNetworks: ['ETHEREUM', 'POLYGON', 'BSC', 'ARBITRUM', 'OPTIMISM', 'AVALANCHE', 'BASE', 'SUI'],
          paymentMethods: ['deposit_address', 'smart_contract'],
        },
      };
    } catch (error) {
      this.logger.error(`Get payment options error: ${error.message}`);
      return { success: false, error: `Failed to get payment options: ${error.message}` };
    }
  }

  private async initiateDepositPayment(
    args: InitiateDepositPaymentArgs,
    userId: string | undefined,
  ): Promise<ToolResult> {
    if (!userId) return { success: false, error: 'Authentication required' };

    try {
      // Find existing wallet or create one for this network + stablecoin
      const wallets = await this.walletsService.getUserWallets(userId) as WalletEntity[];
      let wallet = wallets.find(
        (w: WalletEntity) => w.network === args.networkId && w.stablecoinType === args.stablecoin,
      );

      if (!wallet) {
        wallet = await this.walletsService.createWallet(userId, {
          stablecoinType: args.stablecoin,
          network: args.networkId,
        }) as WalletEntity;
      }

      return {
        success: true,
        data: {
          depositAddress: wallet.depositAddress,
          network: args.networkId,
          stablecoin: args.stablecoin,
          orderId: args.orderId,
          instructions: `Send your ${args.stablecoin} to the deposit address below on the ${args.networkId} network. Payment will be detected automatically.`,
        },
      };
    } catch (error) {
      this.logger.error(`Initiate deposit payment error: ${error.message}`);
      return { success: false, error: `Failed to initiate deposit payment: ${error.message}` };
    }
  }

  private async initiateSmartContractPayment(
    args: InitiateSmartContractPaymentArgs,
  ): Promise<ToolResult> {
    // Smart contract payment parameters are assembled here;
    // the actual on-chain call is executed by the frontend widget.
    return {
      success: true,
      data: {
        method: 'smart_contract',
        orderId: args.orderId,
        network: args.networkId,
        stablecoin: args.stablecoin,
        status: 'pending_frontend_execution',
        instructions:
          'Smart contract payment will be initiated on the frontend. ' +
          'Please approve the transaction in your connected wallet.',
      },
    };
  }
}
