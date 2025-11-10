import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  Matches,
  Length,
} from 'class-validator';

export class SendOtpDto {
  @ApiProperty({ example: 'user@example.com', description: 'Email address' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: '+1',
    description: 'Country code (optional for now)',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Matches(/^\+\d{1,4}$/, {
    message: 'Country code must start with + and contain 1-4 digits',
  })
  countryCode?: string;

  @ApiProperty({
    example: '1234567890',
    description: 'Phone number (optional for now)',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Length(7, 15)
  @Matches(/^\d+$/, { message: 'Phone number must contain only digits' })
  phoneNumber?: string;
}
