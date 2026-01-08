import { IsString, IsOptional, IsEmail, IsEnum, MinLength, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateMerchantProfileDto {
  @ApiProperty({ example: 'TechCorp Inc.', description: 'Company legal name' })
  @IsString()
  @MinLength(2)
  companyName: string;

  @ApiProperty({ example: 'TechCorp', required: false })
  @IsOptional()
  @IsString()
  tradingName?: string;

  @ApiProperty({
    example: 'MANUFACTURER',
    enum: ['MANUFACTURER', 'DISTRIBUTOR', 'WHOLESALER', 'RETAILER', 'AGENCY', 'BRAND', 'INDIVIDUAL']
  })
  @IsEnum(['MANUFACTURER', 'DISTRIBUTOR', 'WHOLESALER', 'RETAILER', 'AGENCY', 'BRAND', 'INDIVIDUAL'])
  sellerType: string;

  @ApiProperty({ example: 'REG123456', required: false })
  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @ApiProperty({ example: 'TAX123456', required: false })
  @IsOptional()
  @IsString()
  taxId?: string;

  @ApiProperty({ example: '+1234567890' })
  @IsString()
  @MinLength(10)
  phone: string;

  @ApiProperty({ example: 'https://techcorp.com', required: false })
  @IsOptional()
  @IsUrl()
  website?: string;

  @ApiProperty({ example: 'https://example.com/logo.png', required: false })
  @IsOptional()
  @IsUrl()
  logo?: string;

  @ApiProperty({ example: 'https://example.com/banner.png', required: false })
  @IsOptional()
  @IsUrl()
  banner?: string;

  @ApiProperty({ example: '123 Main St' })
  @IsString()
  @MinLength(5)
  addressLine1: string;

  @ApiProperty({ example: 'Suite 100', required: false })
  @IsOptional()
  @IsString()
  addressLine2?: string;

  @ApiProperty({ example: 'San Francisco' })
  @IsString()
  @MinLength(2)
  city: string;

  @ApiProperty({ example: 'CA' })
  @IsString()
  @MinLength(2)
  state: string;

  @ApiProperty({ example: '94102' })
  @IsString()
  @MinLength(3)
  postalCode: string;

  @ApiProperty({ example: 'USA' })
  @IsString()
  @MinLength(2)
  country: string;

  @ApiProperty({ example: 'Leading manufacturer of electronics...' })
  @IsString()
  @MinLength(20)
  description: string;
}
