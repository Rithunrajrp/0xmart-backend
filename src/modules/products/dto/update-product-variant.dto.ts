import { PartialType } from '@nestjs/swagger';
import { CreateProductVariantDto } from './create-product-variant.dto';
import { OmitType } from '@nestjs/swagger';

export class UpdateProductVariantDto extends PartialType(
  OmitType(CreateProductVariantDto, ['productId'] as const),
) {}
