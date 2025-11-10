import { ApiProperty } from '@nestjs/swagger';
import { StablecoinType, NetworkType } from '@prisma/client';

export class WalletEntity {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty({ enum: StablecoinType })
  stablecoinType: StablecoinType;

  @ApiProperty({ enum: NetworkType })
  network: NetworkType;

  @ApiProperty()
  depositAddress: string;

  @ApiProperty()
  balance: string;

  @ApiProperty()
  lockedBalance: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
