
import { PartialType } from '@nestjs/swagger';
import { CreateMerchantProductDto } from './create-product.dto';
import { IsOptional, IsString, IsEnum } from 'class-validator';

export class UpdateMerchantProductDto extends PartialType(CreateMerchantProductDto) {
  @IsOptional()
  @IsString()
  @IsEnum(['DRAFT', 'ACTIVE', 'ARCHIVED'])
  status?: string;
}
