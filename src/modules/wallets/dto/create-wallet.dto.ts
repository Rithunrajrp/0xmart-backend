import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { StablecoinType, NetworkType } from '@prisma/client';

export class CreateWalletDto {
  @ApiProperty({ enum: StablecoinType })
  @IsEnum(StablecoinType)
  @IsNotEmpty()
  stablecoinType: StablecoinType;

  @ApiProperty({ enum: NetworkType })
  @IsEnum(NetworkType)
  @IsNotEmpty()
  network: NetworkType;
}
