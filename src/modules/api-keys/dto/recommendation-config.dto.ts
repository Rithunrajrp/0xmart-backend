import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsBoolean,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RecommendationConfigDto {
  @ApiProperty({
    example: ['prod-123', 'prod-456'],
    description: 'Array of specific product IDs to recommend',
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedProductIds?: string[];

  @ApiProperty({
    example: ['Electronics', 'Fashion'],
    description: 'Array of product categories to recommend from',
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedCategories?: string[];

  @ApiProperty({
    example: 4.0,
    description: 'Minimum product rating (1-5)',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  minRating?: number;

  @ApiProperty({
    example: 1000,
    description: 'Maximum product price in USDT',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiProperty({
    example: 10,
    description: 'Minimum product price in USDT',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiProperty({
    example: true,
    description: 'Prioritize in-stock products',
    required: false,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  prioritizeInStock?: boolean;

  @ApiProperty({
    example: false,
    description: 'Prioritize high-rated products',
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  prioritizeHighRated?: boolean;
}

export class UpdateRecommendationConfigDto extends RecommendationConfigDto {}
