import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateShopifyMerchantDto {
  @ApiProperty({
    description: 'Store email from Shopify',
    example: 'store@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Store name from Shopify',
    example: 'My Awesome Store',
  })
  @IsString()
  @IsNotEmpty()
  storeName: string;

  @ApiProperty({
    description: 'Shopify shop domain',
    example: 'my-store.myshopify.com',
  })
  @IsString()
  @IsNotEmpty()
  shopifyShop: string;

  @ApiProperty({
    description: 'Store country',
    example: 'US',
    required: false,
  })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiProperty({
    description: 'Store currency code',
    example: 'USD',
  })
  @IsString()
  @IsNotEmpty()
  currency: string;
}
