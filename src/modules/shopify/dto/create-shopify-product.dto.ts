import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsNotEmpty,
  IsInt,
  Min,
} from 'class-validator';

export class CreateShopifyProductDto {
  @ApiProperty({
    description: 'Product title',
    example: 'Awesome T-Shirt',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Product description',
    example: 'A comfortable cotton t-shirt',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Price in USDT (after conversion with commission)',
    example: 25.99,
  })
  @IsNumber()
  @Min(0)
  priceUsdt: number;

  @ApiProperty({
    description: 'Product image URL',
    example: 'https://cdn.shopify.com/...',
    required: false,
  })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiProperty({
    description: 'Shopify product ID (GID)',
    example: 'gid://shopify/Product/123456',
  })
  @IsString()
  @IsNotEmpty()
  shopifyProductId: string;

  @ApiProperty({
    description: 'Shopify variant ID',
    example: 'gid://shopify/ProductVariant/789',
    required: false,
  })
  @IsString()
  @IsOptional()
  shopifyVariantId?: string;

  @ApiProperty({
    description: 'Product category',
    example: 'Clothing',
    required: false,
  })
  @IsString()
  @IsOptional()
  categoryId?: string;

  @ApiProperty({
    description: 'Inventory quantity',
    example: 100,
    required: false,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  inventory?: number;
}

export class UpdateShopifyProductDto {
  @ApiProperty({
    description: 'Product title',
    required: false,
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty({
    description: 'Product description',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Price in USDT',
    required: false,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  priceUsdt?: number;

  @ApiProperty({
    description: 'Product image URL',
    required: false,
  })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiProperty({
    description: 'Is product active',
    required: false,
  })
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({
    description: 'Inventory quantity',
    required: false,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  inventory?: number;
}
