import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
  Matches,
  MaxLength,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { StablecoinType } from '@prisma/client';

class ProductPriceDto {
  @ApiProperty({ enum: StablecoinType })
  @IsEnum(StablecoinType)
  stablecoinType: StablecoinType;

  @ApiProperty({
    example: '99.99',
    description: 'Price in decimal format (e.g., 99.99). Up to 8 decimal places allowed.'
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+(\.\d{1,8})?$/, {
    message: 'Price must be a valid positive decimal number with up to 8 decimal places (e.g., 99.99, 0.00000001)',
  })
  price: string;
}

export class CreateProductDto {
  @ApiProperty({ example: 'uuid-of-seller', description: 'Seller ID' })
  @IsString()
  @IsNotEmpty()
  sellerId: string;

  @ApiProperty({ example: 'Premium Coffee Beans' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '1kg bag of premium arabica coffee beans' })
  @IsString()
  @IsOptional()
  @MaxLength(5000, {
    message: 'Description cannot exceed 5000 characters',
  })
  description?: string;

  @ApiProperty({
    example: 'https://example.com/image.jpg',
    description: 'Product image URL (can be from S3 or external CDN)',
    required: false
  })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiProperty({
    example: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
    description: 'Array of product image URLs (max 10) - can be from S3 or external CDN',
    required: false
  })
  @IsArray()
  @IsOptional()
  images?: string[];

  @ApiProperty({ example: 'Coffee' })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiProperty({ type: [ProductPriceDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductPriceDto)
  prices: ProductPriceDto[];

  @ApiProperty({
    example: ['US', 'IN', 'GB', 'CA'],
    description: 'Array of ISO 3166-1 alpha-2 country codes where the product can be shipped',
    required: false,
    type: [String]
  })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  @ArrayMinSize(1, { message: 'At least one country must be specified if provided' })
  availableCountries?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  metadata?: any;
}
