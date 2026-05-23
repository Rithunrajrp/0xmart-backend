import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsBoolean,
  Matches,
} from 'class-validator';
import { NetworkType, StablecoinType } from '@prisma/client';

export class CreateMerchantWalletDto {
  @ApiProperty({
    enum: NetworkType,
    description: 'Blockchain network for the wallet',
    example: 'POLYGON',
  })
  @IsEnum(NetworkType)
  @IsNotEmpty()
  network: NetworkType;

  @ApiProperty({
    enum: StablecoinType,
    description: 'Stablecoin type to receive',
    example: 'USDT',
  })
  @IsEnum(StablecoinType)
  @IsNotEmpty()
  stablecoinType: StablecoinType;

  @ApiProperty({
    description: 'Wallet address to receive settlements',
    example: '0x1234567890abcdef1234567890abcdef12345678',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^0x[a-fA-F0-9]{40}$|^[1-9A-HJ-NP-Za-km-z]{32,44}$/, {
    message: 'Invalid wallet address format',
  })
  walletAddress: string;

  @ApiPropertyOptional({
    description: 'Label for the wallet',
    example: 'Primary USDT Wallet',
  })
  @IsString()
  @IsOptional()
  label?: string;

  @ApiPropertyOptional({
    description: 'Set as default wallet for this stablecoin',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
