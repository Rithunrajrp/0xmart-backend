import { ApiProperty } from '@nestjs/swagger';
import {
  FiatPaymentProvider,
  FiatPaymentStatus,
  StablecoinType,
} from '@prisma/client';

export class FiatPurchaseEntity {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty({ enum: FiatPaymentProvider })
  provider: FiatPaymentProvider;

  @ApiProperty()
  providerTxId: string;

  @ApiProperty({ enum: StablecoinType })
  stablecoinType: StablecoinType;

  @ApiProperty()
  fiatAmount: string;

  @ApiProperty()
  fiatCurrency: string;

  @ApiProperty()
  stablecoinAmount: string;

  @ApiProperty()
  exchangeRate: string;

  @ApiProperty()
  processingFee: string;

  @ApiProperty({ enum: FiatPaymentStatus })
  status: FiatPaymentStatus;

  @ApiProperty()
  paymentMethod: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  completedAt: Date | null;
}

export class CreatePurchaseResponseEntity {
  @ApiProperty()
  purchaseId: string;

  @ApiProperty()
  clientSecret: string;

  @ApiProperty()
  paymentUrl: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  currency: string;
}
