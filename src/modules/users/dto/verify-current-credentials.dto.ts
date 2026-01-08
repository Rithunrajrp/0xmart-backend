import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyCurrentCredentialsDto {
  @ApiProperty({
    description: 'OTP sent to current email',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty()
  emailOtp: string;

  @ApiProperty({
    description: 'OTP sent to current phone number',
    example: '654321',
  })
  @IsString()
  @IsNotEmpty()
  phoneOtp: string;
}
