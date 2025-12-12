import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  Min,
  Max,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class PriceRangeDto {
  @ApiProperty({ example: 100, description: 'Minimum price' })
  @IsNumber()
  @Min(0)
  min: number;

  @ApiProperty({ example: 500, description: 'Maximum price' })
  @IsNumber()
  @Min(0)
  max: number;
}

export class GetRecommendationsDto {
  @ApiProperty({
    example: 'electronics',
    description: 'Product category',
    required: false,
  })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiProperty({
    type: PriceRangeDto,
    description: 'Price range filter',
    required: false,
  })
  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => PriceRangeDto)
  priceRange?: PriceRangeDto;

  @ApiProperty({
    example: 'India',
    description: 'Customer location for regional targeting',
    required: false,
  })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiProperty({
    example: 'repeat_customer',
    description: 'Customer type (new, repeat_customer, vip)',
    required: false,
  })
  @IsString()
  @IsOptional()
  userType?: string;

  @ApiProperty({
    example: ['wireless', 'bluetooth'],
    description: 'Keywords to match products',
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  keywords?: string[];

  @ApiProperty({
    example: 'session_abc123',
    description: 'Customer session ID for tracking',
    required: false,
  })
  @IsString()
  @IsOptional()
  customerSessionId?: string;

  @ApiProperty({
    example: 10,
    description: 'Maximum number of recommendations to return',
    required: false,
    default: 10,
  })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class AdClickOpenDto {
  @ApiProperty({
    example: 'click_token_abc123',
    description: 'Unique click tracking token',
  })
  @IsString()
  adClickToken: string;
}
