import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEmail,
  Matches,
  Length,
} from 'class-validator';

export class VerifyMerchantTokenDto {
  @ApiProperty({ example: 'merchant@company.com', description: 'Merchant email address' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: '+1',
    description: 'Country code',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+\d{1,4}$/, {
    message: 'Country code must start with + and contain 1-4 digits',
  })
  countryCode: string;

  @ApiProperty({
    example: '1234567890',
    description: 'Phone number',
  })
  @IsString()
  @IsNotEmpty()
  @Length(7, 15)
  @Matches(/^\d+$/, { message: 'Phone number must contain only digits' })
  phoneNumber: string;

  @ApiProperty({
    example: 'c8734f029678f06a6425c57424f49cf12681b1610f19998992610a8e2a825045',
    description: 'Onboarding token from email',
  })
  @IsString()
  @IsNotEmpty()
  @Length(64, 64, { message: 'Token must be exactly 64 characters' })
  token: string;
}
