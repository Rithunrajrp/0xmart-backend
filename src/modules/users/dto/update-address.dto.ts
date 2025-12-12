import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsOptional, IsBoolean } from 'class-validator';
import { AddressType } from '@prisma/client';

export class UpdateAddressDto {
  @ApiProperty({ enum: AddressType, required: false })
  @IsEnum(AddressType)
  @IsOptional()
  type?: AddressType;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  label?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  fullName?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  addressLine1?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  addressLine2?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  postalCode?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
