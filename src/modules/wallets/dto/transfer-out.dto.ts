import { ApiProperty } from '@nestjs/swagger';
import { NetworkType, StablecoinType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString, Matches } from 'class-validator';

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

  @ApiProperty({
    example: '100.50',
    description: 'Amount to transfer in decimal format (e.g., 100.50). Up to 8 decimal places allowed.'
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+(\.\d{1,8})?$/, {
    message: 'Amount must be a valid positive decimal number with up to 8 decimal places (e.g., 100.50, 0.00000001)',
  })
  amount: string;
}
