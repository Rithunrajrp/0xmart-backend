import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsNumber,
  Min,
  IsEnum,
} from 'class-validator';
import { NetworkType, StablecoinType } from '@prisma/client';

export class InitiatePaymentDto {
  @ApiProperty({ example: 'P123', description: 'Product ID to purchase' })
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({ example: 1, description: 'Quantity to purchase', default: 1 })
  @IsNumber()
  @IsOptional()
  @Min(1)
  quantity?: number;

  @ApiProperty({
    example: '+919876543210',
    description: 'Customer phone number with country code',
  })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({
    example: 'customer@example.com',
    description: 'Customer email address',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: 'USDT',
    description: 'Stablecoin type for payment',
    enum: ['USDT', 'USDC', 'DAI', 'BUSD'],
  })
  @IsEnum(['USDT', 'USDC', 'DAI', 'BUSD'])
  @IsNotEmpty()
  stablecoinType: StablecoinType;

  @ApiProperty({
    example: 'TON',
    description: 'Preferred blockchain network',
    enum: [
      'ETHEREUM',
      'POLYGON',
      'BSC',
      'ARBITRUM',
      'OPTIMISM',
      'AVALANCHE',
      'BASE',
      'SUI',
      'TON',
      'SOLANA',
    ],
    required: false,
  })
  @IsEnum([
    'ETHEREUM',
    'POLYGON',
    'BSC',
    'ARBITRUM',
    'OPTIMISM',
    'AVALANCHE',
    'BASE',
    'SUI',
    'TON',
    'SOLANA',
  ])
  @IsOptional()
  network?: NetworkType;

  @ApiProperty({
    example: 'click_abc123',
    description: 'Ad click token for tracking conversions',
    required: false,
  })
  @IsString()
  @IsOptional()
  adClickToken?: string;

  @ApiProperty({
    example: 'idem_abc123',
    description: 'Idempotency key to prevent duplicate orders',
    required: false,
  })
  @IsString()
  @IsOptional()
  idempotencyKey?: string;
}

export class VerifyExternalOtpDto {
  @ApiProperty({ example: 'order_abc123', description: 'Order ID' })
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({ example: '123456', description: 'OTP code' })
  @IsString()
  @IsNotEmpty()
  otp: string;

  @ApiProperty({
    example: 'email',
    description: 'Verification type',
    enum: ['email', 'phone'],
  })
  @IsEnum(['email', 'phone'])
  @IsNotEmpty()
  type: 'email' | 'phone';
}

export class SubmitAddressDto {
  @ApiProperty({ example: 'order_abc123', description: 'Order ID' })
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({ example: 'John Doe', description: 'Full name' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ example: '123 Main Street', description: 'Address line 1' })
  @IsString()
  @IsNotEmpty()
  addressLine1: string;

  @ApiProperty({
    example: 'Apt 4B',
    description: 'Address line 2',
    required: false,
  })
  @IsString()
  @IsOptional()
  addressLine2?: string;

  @ApiProperty({ example: 'New York', description: 'City' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({
    example: 'NY',
    description: 'State/Province',
    required: false,
  })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiProperty({ example: '10001', description: 'Postal/ZIP code' })
  @IsString()
  @IsNotEmpty()
  postalCode: string;

  @ApiProperty({ example: 'USA', description: 'Country' })
  @IsString()
  @IsNotEmpty()
  country: string;

  @ApiProperty({
    example: 'Near Central Park',
    description: 'Landmark',
    required: false,
  })
  @IsString()
  @IsOptional()
  landmark?: string;
}

export class SelectNetworkDto {
  @ApiProperty({ example: 'order_abc123', description: 'Order ID' })
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({
    example: 'TON',
    description: 'Selected blockchain network',
    enum: [
      'ETHEREUM',
      'POLYGON',
      'BSC',
      'ARBITRUM',
      'OPTIMISM',
      'AVALANCHE',
      'BASE',
      'SUI',
      'TON',
      'SOLANA',
    ],
  })
  @IsEnum([
    'ETHEREUM',
    'POLYGON',
    'BSC',
    'ARBITRUM',
    'OPTIMISM',
    'AVALANCHE',
    'BASE',
    'SUI',
    'TON',
    'SOLANA',
  ])
  @IsNotEmpty()
  network: NetworkType;
}

export class ConfirmExternalPaymentDto {
  @ApiProperty({ example: 'order_abc123', description: 'Order ID' })
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({
    example: '0xabc123...',
    description: 'Transaction hash from blockchain',
  })
  @IsString()
  @IsNotEmpty()
  txHash: string;
}

export class ResendOtpDto {
  @ApiProperty({ example: 'order_abc123', description: 'Order ID' })
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({
    example: 'email',
    description: 'OTP type to resend',
    enum: ['email', 'phone'],
  })
  @IsEnum(['email', 'phone'])
  @IsNotEmpty()
  type: 'email' | 'phone';
}
