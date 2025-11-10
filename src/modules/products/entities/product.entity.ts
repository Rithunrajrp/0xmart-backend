import { ApiProperty } from '@nestjs/swagger';
import { ProductStatus, StablecoinType } from '@prisma/client';

export class ProductPriceEntity {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: StablecoinType })
  stablecoinType: StablecoinType;

  @ApiProperty()
  price: string;
}

export class ProductEntity {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string | null;

  @ApiProperty()
  imageUrl: string | null;

  @ApiProperty()
  category: string | null;

  @ApiProperty({ enum: ProductStatus })
  status: ProductStatus;

  @ApiProperty({ type: [ProductPriceEntity] })
  prices: ProductPriceEntity[];

  @ApiProperty()
  metadata: any;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
