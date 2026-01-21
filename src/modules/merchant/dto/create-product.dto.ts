
import { IsString, IsNotEmpty, IsOptional, IsNumber, IsArray, IsBoolean, ValidateNested, Min, Matches, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class PriceDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  currency: string;

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

export class CreateMerchantProductDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @MaxLength(500, {
    message: 'Short description cannot exceed 500 characters',
  })
  shortDescription?: string;

  @ApiProperty({ example: '1kg bag of premium arabica coffee beans' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000, {
    message: 'Description cannot exceed 5000 characters',
  })
  description: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  brand?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  sku?: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  stock: number;

  @ApiProperty({ type: [PriceDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PriceDto)
  prices: PriceDto[];

  @ApiProperty({ type: [String], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  isDigital?: boolean;

  @ApiProperty({
    example: ['US', 'IN', 'GB', 'CA'],
    description: 'Array of ISO 3166-1 alpha-2 country codes where the product can be shipped',
    required: false,
    type: [String]
  })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  availableCountries?: string[];
}
