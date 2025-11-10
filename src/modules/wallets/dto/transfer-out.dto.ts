import { ApiProperty } from '@nestjs/swagger';
import { NetworkType, StablecoinType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class TransferOutDto {
  @ApiProperty({ enum: StablecoinType })
  @IsEnum(StablecoinType)
  @IsNotEmpty()
  stablecoinType: StablecoinType;

  @ApiProperty({ enum: NetworkType })
  @IsEnum(NetworkType)
  @IsNotEmpty()
  network: NetworkType;

  @ApiProperty({ example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb' })
  @IsString()
  @IsNotEmpty()
  toAddress: string;

  @ApiProperty({ example: '100.50' })
  @IsString()
  @IsNotEmpty()
  amount: string;
}
