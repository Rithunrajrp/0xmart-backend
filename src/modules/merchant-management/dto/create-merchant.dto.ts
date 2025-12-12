import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Matches } from 'class-validator';

export class CreateMerchantDto {
  @ApiProperty({
    example: 'merchant@example.com',
    description: 'Merchant email address',
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

  @ApiProperty({ example: 'Acme Corporation', description: 'Company name' })
  @IsString()
  @IsNotEmpty()
  companyName: string;
}
