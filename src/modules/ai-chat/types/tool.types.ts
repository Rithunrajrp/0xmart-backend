import { StablecoinType, NetworkType, ProductStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Product entity with pricing information
 */
export interface ProductEntity {
  id: string;
  name: string;
  description: string | null;
  longDescription: string | null;
  category: string;
  stock: number;
  status: ProductStatus;
  rating: number | Decimal | null;
  totalReviews: number;
  reviewCount: number;
  prices: ProductPriceEntity[];
  seller?: SellerEntity;
  specifications?: any;
}

export interface ProductPriceEntity {
  price: number | string | Decimal;
  stablecoinType: StablecoinType;
}

export interface SellerEntity {
  businessName?: string;
  tradingName?: string;
}

/**
 * Wallet entity
 */
export interface WalletEntity {
  id: string;
  network: NetworkType;
  stablecoinType: StablecoinType;
  depositAddress: string;
  balance: number | string | Decimal;
  lockedBalance: number | string | Decimal;
}

/**
 * User address entity
 */
export interface UserAddressEntity {
  id: string;
  type: 'SHIPPING' | 'BILLING';
  fullName: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string | null;
  postalCode: string;
  country: string;
  phone: string;
  isDefault: boolean;
}

/**
 * Order creation DTO
 */
export interface CreateOrderDto {
  stablecoinType: StablecoinType;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  shippingAddress: {
    name: string;
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    phone: string;
  };
}

/**
 * Order entity
 */
export interface OrderEntity {
  id: string;
  orderNumber: string;
  totalAmount: number | string | Decimal;
  status: string;
}

/**
 * Tool arguments
 */
export interface SearchProductsArgs {
  query: string;
  limit?: number;
  minPrice?: number;
  maxPrice?: number;
  category?: string;
}

export interface GetProductDetailsArgs {
  productId: string;
}

export interface PlaceOrderArgs {
  stablecoin: StablecoinType;
  shippingAddressId: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
}

export interface InitiateDepositPaymentArgs {
  orderId: string;
  networkId: NetworkType;
  stablecoin: StablecoinType;
}

export interface InitiateSmartContractPaymentArgs {
  orderId: string;
  networkId: NetworkType;
  stablecoin: StablecoinType;
}

/**
 * Tool execution result
 */
export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Simplified product for chat display
 */
export interface ChatProductResponse {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  priceDisplay: string;
  currency: string;
  category: string;
  inStock: boolean;
  stock: number;
  rating: number;
  reviews: number;
}

/**
 * Simplified wallet for chat display
 */
export interface ChatWalletResponse {
  id: string;
  network: NetworkType;
  stablecoin: StablecoinType;
  depositAddress: string;
  balance: string;
  lockedBalance: string;
}

/**
 * Simplified address for chat display
 */
export interface ChatAddressResponse {
  id: string;
  type: 'SHIPPING' | 'BILLING';
  fullName: string;
  street: string;
  city: string;
  state: string | null;
  postalCode: string;
  country: string;
  phone: string;
  isDefault: boolean;
}
