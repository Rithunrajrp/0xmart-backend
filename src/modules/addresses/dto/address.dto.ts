import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  MinLength,
} from 'class-validator';
import { AddressType } from '@prisma/client';

export class CreateAddressRequestDto {
  @ApiProperty({ enum: AddressType, example: 'SHIPPING' })
  @IsEnum(AddressType)
  type: AddressType;

  @ApiProperty({ required: false, example: 'Home' })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @MinLength(1)
  fullName: string;

  @ApiProperty({ example: '+1234567890' })
  @IsString()
  @MinLength(1)
  phone: string;

  @ApiProperty({ example: '123 Main St' })
  @IsString()
  @MinLength(1)
  addressLine1: string;

  @ApiProperty({ required: false, example: 'Apt 4B' })
  @IsOptional()
  @IsString()
  addressLine2?: string;

  @ApiProperty({ example: 'New York' })
  @IsString()
  @MinLength(1)
  city: string;

  @ApiProperty({ required: false, example: 'NY' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({ example: '10001' })
  @IsString()
  @MinLength(1)
  postalCode: string;

  @ApiProperty({ example: 'USA' })
  @IsString()
  @MinLength(1)
  country: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateAddressRequestDto {
  @ApiProperty({ enum: AddressType, example: 'SHIPPING', required: false })
  @IsOptional()
  @IsEnum(AddressType)
  type?: AddressType;

  @ApiProperty({ required: false, example: 'Home' })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiProperty({ example: 'John Doe', required: false })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiProperty({ example: '+1234567890', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: '123 Main St', required: false })
  @IsOptional()
  @IsString()
  addressLine1?: string;

  @ApiProperty({ required: false, example: 'Apt 4B' })
  @IsOptional()
  @IsString()
  addressLine2?: string;

  @ApiProperty({ example: 'New York', required: false })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({ required: false, example: 'NY' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({ example: '10001', required: false })
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiProperty({ example: 'USA', required: false })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
