import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsInt, Min, Max, IsString, IsOptional, IsArray } from 'class-validator';

export class CreateReviewDto {
  @ApiProperty({ description: 'Product ID' })
  @IsNotEmpty()
  @IsString()
  productId: string;

  @ApiProperty({ description: 'Rating (1-5)', minimum: 1, maximum: 5 })
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({ description: 'Review title', required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ description: 'Review comment', required: false })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiProperty({ description: 'Review images', required: false, type: [String] })
  @IsOptional()
  @IsArray()
  images?: string[];
}
