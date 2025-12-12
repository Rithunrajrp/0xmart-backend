import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsOptional,
  IsEnum,
  Min,
  Max,
  IsEthereumAddress,
} from 'class-validator';
import { NetworkType } from '../constants/contract-addresses';

export class InitiateContractPaymentDto {
  @ApiProperty({
    description: 'Product ID to purchase',
    example: 'P123',
  })
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({
    description: 'Quantity to purchase',
    example: 1,
    minimum: 1,
    default: 1,
  })
  @IsNumber()
  @IsPositive()
  @IsOptional()
  quantity?: number;

  @ApiProperty({
    description: 'Network to use for payment',
    enum: NetworkType,
    example: NetworkType.POLYGON,
  })
  @IsEnum(NetworkType)
  @IsNotEmpty()
  network: NetworkType;

  @ApiProperty({
    description: 'Token symbol (USDT, USDC, DAI, BUSD)',
    example: 'USDT',
  })
  @IsString()
  @IsNotEmpty()
  stablecoinType: string;

  @ApiProperty({
    description: 'Wallet address that will make the payment',
    example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  })
  @IsEthereumAddress()
  @IsNotEmpty()
  buyerAddress: string;

  @ApiProperty({
    description: 'API key owner address for commission tracking (optional)',
    example: '0x0000000000000000000000000000000000000000',
    required: false,
  })
  @IsEthereumAddress()
  @IsOptional()
  apiKeyOwnerAddress?: string;

  @ApiProperty({
    description: 'Commission in basis points (500 = 5%)',
    example: 500,
    minimum: 0,
    maximum: 10000,
    required: false,
  })
  @IsNumber()
  @Min(0)
  @Max(10000)
  @IsOptional()
  commissionBps?: number;

  @ApiProperty({
    description: 'Shipping address ID (optional)',
    example: 1,
    required: false,
  })
  @IsString()
  @IsOptional()
  shippingAddressId?: string;
}

export class InitiateBatchContractPaymentDto {
  @ApiProperty({
    description: 'Array of product IDs with quantities',
    example: [
      { productId: 'P123', quantity: 2 },
      { productId: 'P456', quantity: 1 },
    ],
  })
  @IsNotEmpty()
  products: Array<{
    productId: string;
    quantity: number;
  }>;

  @ApiProperty({
    description: 'Network to use for payment',
    enum: NetworkType,
    example: NetworkType.POLYGON,
  })
  @IsEnum(NetworkType)
  @IsNotEmpty()
  network: NetworkType;

  @ApiProperty({
    description: 'Token symbol (USDT, USDC, DAI, BUSD)',
    example: 'USDT',
  })
  @IsString()
  @IsNotEmpty()
  stablecoinType: string;

  @ApiProperty({
    description: 'Wallet address that will make the payment',
    example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  })
  @IsEthereumAddress()
  @IsNotEmpty()
  buyerAddress: string;

  @ApiProperty({
    description: 'API key owner address for commission tracking (optional)',
    example: '0x0000000000000000000000000000000000000000',
    required: false,
  })
  @IsEthereumAddress()
  @IsOptional()
  apiKeyOwnerAddress?: string;

  @ApiProperty({
    description: 'Commission in basis points (500 = 5%)',
    example: 500,
    minimum: 0,
    maximum: 10000,
    required: false,
  })
  @IsNumber()
  @Min(0)
  @Max(10000)
  @IsOptional()
  commissionBps?: number;

  @ApiProperty({
    description: 'Shipping address ID (optional)',
    example: 1,
    required: false,
  })
  @IsString()
  @IsOptional()
  shippingAddressId?: string;
}

export class ContractPaymentResponseDto {
  @ApiProperty({ description: 'Order ID (bytes32 hex string)' })
  orderId: string;

  @ApiProperty({ description: 'Human-readable order number' })
  orderNumber: string;

  @ApiProperty({ description: 'Payment contract address' })
  contractAddress: string;

  @ApiProperty({ description: 'Token contract address to approve/transfer' })
  tokenAddress: string;

  @ApiProperty({ description: 'Total amount in token units (with decimals)' })
  amount: string;

  @ApiProperty({ description: 'Amount in human-readable format' })
  amountFormatted: string;

  @ApiProperty({ description: 'Platform fee in token units' })
  platformFee: string;

  @ApiProperty({ description: 'Commission amount in token units' })
  commission: string;

  @ApiProperty({ description: 'Network to use' })
  network: NetworkType;

  @ApiProperty({ description: 'Transaction instructions for frontend' })
  instructions: {
    step1: string;
    step2: string;
    step3: string;
  };

  @ApiProperty({ description: 'ABI for contract interaction' })
  abi: any[];

  @ApiProperty({ description: 'Product details' })
  products: Array<{
    productId: string;
    name: string;
    quantity: number;
    price: number;
  }>;
}

export class CheckPaymentStatusDto {
  @ApiProperty({
    description: 'Order ID to check',
    example: '0x1234...',
  })
  @IsString()
  @IsNotEmpty()
  orderId: string;
}

export class PaymentStatusResponseDto {
  @ApiProperty({ description: 'Order ID' })
  orderId: string;

  @ApiProperty({
    description: 'Payment status',
    enum: ['PENDING', 'PAID', 'CONFIRMED', 'FAILED'],
  })
  status: string;

  @ApiProperty({ description: 'Transaction hash (if payment detected)' })
  transactionHash?: string | null;

  @ApiProperty({ description: 'Block number (if confirmed)' })
  blockNumber?: string | null;

  @ApiProperty({ description: 'Payment detected timestamp' })
  paymentDetectedAt?: Date | null;

  @ApiProperty({ description: 'Payment confirmed timestamp' })
  paymentConfirmedAt?: Date | null;
}
