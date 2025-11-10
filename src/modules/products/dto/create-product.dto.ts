import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { StablecoinType } from '@prisma/client';

class ProductPriceDto {
  @ApiProperty({ enum: StablecoinType })
  @IsEnum(StablecoinType)
  stablecoinType: StablecoinType;

  @ApiProperty({ example: '99.99' })
  @IsString()
  @IsNotEmpty()
  price: string;
}

export class CreateProductDto {
  @ApiProperty({ example: 'Premium Coffee Beans' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '1kg bag of premium arabica coffee beans' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 'https://example.com/image.jpg' })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiProperty({ example: 'Coffee' })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiProperty({ type: [ProductPriceDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductPriceDto)
  prices: ProductPriceDto[];

  @ApiProperty({ required: false })
  @IsOptional()
  metadata?: any;
}
