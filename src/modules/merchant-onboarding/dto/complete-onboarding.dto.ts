import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsEmail } from 'class-validator';

export class CompleteOnboardingDto {
  @ApiProperty({
    example: 'abc123token...',
    description: 'Onboarding token from email link',
  })
  @IsString()
  @IsNotEmpty()
  onboardingToken: string;

  @ApiProperty({
    example: '123 Business Street, City',
    description: 'Business address',
  })
  @IsString()
  @IsNotEmpty()
  businessAddress: string;

  @ApiProperty({ example: 'India', description: 'Country of operation' })
  @IsString()
  @IsNotEmpty()
  country: string;

  @ApiProperty({
    example: '29ABCDE1234F1Z5',
    description: 'GST Number (for India)',
    required: false,
  })
  @IsString()
  @IsOptional()
  gstNumber?: string;

  @ApiProperty({
    example: 'ABCDE1234F',
    description: 'PAN Number (for India)',
    required: false,
  })
  @IsString()
  @IsOptional()
  panNumber?: string;

  @ApiProperty({
    example: 'U12345DL2020PTC123456',
    description: 'CIN Number (for India)',
    required: false,
  })
  @IsString()
  @IsOptional()
  cinNumber?: string;

  @ApiProperty({
    example: 'John Doe',
    description: 'Contact person name',
    required: false,
  })
  @IsString()
  @IsOptional()
  contactPersonName?: string;

  @ApiProperty({
    example: 'john@company.com',
    description: 'Contact person email',
    required: false,
  })
  @IsEmail()
  @IsOptional()
  contactPersonEmail?: string;
}
