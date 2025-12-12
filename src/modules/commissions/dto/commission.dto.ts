import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsNumber,
  Min,
} from 'class-validator';
import { NetworkType, StablecoinType, CommissionStatus } from '@prisma/client';

export class RequestPayoutDto {
  @ApiProperty({
    example: '0x1234...',
    description: 'Wallet address for payout',
  })
  @IsString()
  @IsNotEmpty()
  walletAddress: string;

  @ApiProperty({
    example: 'POLYGON',
    description: 'Blockchain network for payout',
    enum: [
      'ETHEREUM',
      'POLYGON',
      'BSC',
      'ARBITRUM',
      'OPTIMISM',
      'AVALANCHE',
      'SUI',
      'TON',
      'BASE',
    ],
  })
  @IsEnum([
    'ETHEREUM',
    'POLYGON',
    'BSC',
    'ARBITRUM',
    'OPTIMISM',
    'AVALANCHE',
    'SUI',
    'TON',
    'BASE',
  ])
  @IsNotEmpty()
  network: NetworkType;

  @ApiProperty({
    example: 'USDT',
    description: 'Stablecoin type for payout',
    enum: ['USDT', 'USDC', 'DAI', 'BUSD'],
  })
  @IsEnum(['USDT', 'USDC', 'DAI', 'BUSD'])
  @IsNotEmpty()
  stablecoinType: StablecoinType;
}

export class UpdatePayoutWalletDto {
  @ApiProperty({
    example: '0x1234...',
    description: 'Wallet address for future payouts',
  })
  @IsString()
  @IsNotEmpty()
  walletAddress: string;

  @ApiProperty({
    example: 'POLYGON',
    description: 'Preferred network for payouts',
    enum: [
      'ETHEREUM',
      'POLYGON',
      'BSC',
      'ARBITRUM',
      'OPTIMISM',
      'AVALANCHE',
      'SUI',
      'TON',
      'BASE',
    ],
  })
  @IsEnum([
    'ETHEREUM',
    'POLYGON',
    'BSC',
    'ARBITRUM',
    'OPTIMISM',
    'AVALANCHE',
    'SUI',
    'TON',
    'BASE',
  ])
  @IsNotEmpty()
  network: NetworkType;
}

export class GetCommissionHistoryDto {
  @ApiProperty({
    example: 'AVAILABLE',
    description: 'Filter by commission status',
    required: false,
    enum: ['PENDING', 'CONFIRMED', 'AVAILABLE', 'PAID', 'CANCELLED'],
  })
  @IsEnum(['PENDING', 'CONFIRMED', 'AVAILABLE', 'PAID', 'CANCELLED'])
  @IsOptional()
  status?: CommissionStatus;

  @ApiProperty({ example: 1, description: 'Page number', required: false })
  @IsNumber()
  @IsOptional()
  @Min(1)
  page?: number;

  @ApiProperty({ example: 20, description: 'Items per page', required: false })
  @IsNumber()
  @IsOptional()
  @Min(1)
  limit?: number;
}
