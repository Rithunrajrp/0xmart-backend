import { IsEmail, IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateEmailDto {
  @ApiProperty({
    description: 'New email address',
    example: 'newemail@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  newEmail: string;
}

export class VerifyEmailUpdateDto {
  @ApiProperty({
    description: 'OTP sent to new email',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty()
  emailOtp: string;
}
