import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Matches } from 'class-validator';

export class CreateAdminDto {
  @ApiProperty({
    example: 'admin@0xmart.com',
    description: 'Admin email address',
  })
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

  @ApiProperty({
    example: 'John Doe',
    description: 'Admin full name',
    required: false,
  })
  @IsString()
  name?: string;
}
