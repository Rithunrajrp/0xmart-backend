import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsNumber,
  Min,
  IsUUID,
} from 'class-validator';
import { NetworkType, StablecoinType } from '@prisma/client';
import { Transform } from 'class-transformer';

export class CreateSettlementRequestDto {
  @ApiProperty({
    enum: StablecoinType,
    description: 'Stablecoin type for settlement',
    example: 'USDT',
  })
  @IsEnum(StablecoinType)
  @IsNotEmpty()
  stablecoinType: StablecoinType;

  @ApiProperty({
    enum: NetworkType,
    description: 'Network for settlement',
    example: 'POLYGON',
  })
  @IsEnum(NetworkType)
  @IsNotEmpty()
  network: NetworkType;

  @ApiPropertyOptional({
    description: 'Specific wallet ID to receive settlement (uses default if not provided)',
  })
  @IsUUID()
  @IsOptional()
  walletId?: string;

  @ApiPropertyOptional({
    description: 'Specific amount to settle (settles full available balance if not provided)',
  })
  @IsNumber()
  @Min(1)
  @Transform(({ value }) => parseFloat(value))
  @IsOptional()
  amount?: number;

  @ApiPropertyOptional({
    description: 'Notes for the settlement request',
  })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class SettlementFilterDto {
  @ApiPropertyOptional({ enum: StablecoinType })
  @IsEnum(StablecoinType)
  @IsOptional()
  stablecoinType?: StablecoinType;

  @ApiPropertyOptional({ enum: NetworkType })
  @IsEnum(NetworkType)
  @IsOptional()
  network?: NetworkType;

  @ApiPropertyOptional({
    enum: ['PENDING', 'APPROVED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'ON_HOLD'],
  })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  sellerId?: string;

  @ApiPropertyOptional({ description: 'Start date for filtering' })
  @IsString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date for filtering' })
  @IsString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsNumber()
  @Transform(({ value }) => parseInt(value) || 1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsNumber()
  @Transform(({ value }) => parseInt(value) || 20)
  @IsOptional()
  limit?: number;
}
