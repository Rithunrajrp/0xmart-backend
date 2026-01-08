import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsObject,
  IsArray,
  Min,
} from 'class-validator';
import { VariantStatus } from '@prisma/client';

export class CreateProductVariantDto {
  @ApiProperty({ example: 'uuid-of-product', description: 'Product ID' })
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({
    example: 'Red - Large - 500g',
    description: 'Variant name/label',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 'PROD-RED-L-500',
    description: 'Stock Keeping Unit (unique identifier)',
    required: false,
  })
  @IsString()
  @IsOptional()
  sku?: string;

  @ApiProperty({
    example: {
      color: 'Red',
      size: 'Large',
      weight: '500',
      unit: 'grams',
      material: 'Cotton',
      volume: '250',
      volumeUnit: 'milliliters',
    },
    description:
      'Variant attributes (color, size, weight, dimensions, etc.) - flexible key-value pairs',
  })
  @IsObject()
  @IsNotEmpty()
  attributes: Record<string, string>;

  @ApiProperty({
    example: '5.00',
    description:
      'Price adjustment from base product price (can be positive or negative)',
    required: false,
  })
  @IsString()
  @IsOptional()
  priceAdjustment?: string;

  @ApiProperty({ example: 100, description: 'Stock quantity for this variant' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  stock?: number;

  @ApiProperty({
    example: [
      'https://example.com/variant-image1.jpg',
      'https://example.com/variant-image2.jpg',
    ],
    description: 'Array of image URLs specific to this variant',
    required: false,
  })
  @IsArray()
  @IsOptional()
  images?: string[];

  @ApiProperty({
    example: false,
    description: 'Set as default variant for the product',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @ApiProperty({
    enum: VariantStatus,
    example: VariantStatus.ACTIVE,
    required: false,
  })
  @IsEnum(VariantStatus)
  @IsOptional()
  status?: VariantStatus;
}
