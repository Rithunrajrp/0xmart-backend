import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min, Max, IsString, IsOptional, IsArray } from 'class-validator';

export class UpdateReviewDto {
  @ApiProperty({ description: 'Rating (1-5)', minimum: 1, maximum: 5, required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

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
