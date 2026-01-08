import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePhoneDto {
  @ApiProperty({
    description: 'Country code (e.g., +1, +91)',
    example: '+1',
  })
  @IsString()
  @IsNotEmpty()
  countryCode: string;

  @ApiProperty({
    description: 'New phone number without country code',
    example: '9876543210',
  })
  @IsString()
  @IsNotEmpty()
  newPhoneNumber: string;
}

export class VerifyPhoneUpdateDto {
  @ApiProperty({
    description: 'OTP sent to new phone number',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty()
  phoneOtp: string;
}
