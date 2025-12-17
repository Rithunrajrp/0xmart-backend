import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsOptional,
  Length,
  Matches,
} from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '+91', description: 'Country code with plus sign' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+\d{1,4}$/, {
    message: 'Country code must be in format +<digits>',
  })
  countryCode: string;

  @ApiProperty({
    example: '9876543210',
    description: 'Phone number without country code',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{7,15}$/, { message: 'Phone number must contain 7–15 digits' })
  phoneNumber: string;

  @ApiProperty({ example: '123456', description: '6-digit OTP code for email' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'Email OTP must be 6 digits' })
  emailOtp: string;

  @ApiProperty({ example: '654321', description: '6-digit OTP code for phone' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'Phone OTP must be 6 digits' })
  phoneOtp: string;

  @ApiProperty({
    example: 'ABC123XYZ',
    description: 'Referral code from another user (optional)',
    required: false,
  })
  @IsString()
  @IsOptional()
  referralCode?: string;
}
