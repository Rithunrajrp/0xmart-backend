import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsString,
  IsNumber,
  Min,
  IsOptional,
} from 'class-validator';
import { StablecoinType, FiatPaymentProvider } from '@prisma/client';

export class CreatePurchaseDto {
  @ApiProperty({ enum: FiatPaymentProvider, example: 'STRIPE' })
  @IsEnum(FiatPaymentProvider)
  @IsNotEmpty()
  provider: FiatPaymentProvider;

  @ApiProperty({ enum: StablecoinType, example: 'USDT' })
  @IsEnum(StablecoinType)
  @IsNotEmpty()
  stablecoinType: StablecoinType;

  @ApiProperty({
    example: 100,
    description: 'Amount in fiat currency (USD/INR)',
  })
  @IsNumber()
  @Min(10)
  fiatAmount: number;

  @ApiProperty({ example: 'USD', required: false })
  @IsString()
  @IsOptional()
  fiatCurrency?: string;

  @ApiProperty({
    example: 'card',
    required: false,
    description: 'card, upi, netbanking',
  })
  @IsString()
  @IsOptional()
  paymentMethod?: string;
}
