import { ApiProperty } from '@nestjs/swagger';
import { TransactionStatus, StablecoinType, NetworkType } from '@prisma/client';

export class DepositStatusEntity {
  @ApiProperty()
  id: string;

  @ApiProperty()
  txHash: string;

  @ApiProperty()
  amount: string;

  @ApiProperty({ enum: StablecoinType })
  stablecoinType: StablecoinType;

  @ApiProperty({ enum: NetworkType })
  network: NetworkType;

  @ApiProperty()
  confirmations: number;

  @ApiProperty()
  requiredConfirmations: number;

  @ApiProperty({ enum: TransactionStatus })
  status: TransactionStatus;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  confirmedAt: Date | null;
}
