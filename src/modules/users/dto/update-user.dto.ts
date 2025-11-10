import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsOptional,
  Matches,
  Length,
} from 'class-validator';

export class UpdateUserDto {
  @ApiProperty({ required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @Matches(/^\+\d{1,4}$/)
  countryCode?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @Length(7, 15)
  @Matches(/^\d+$/)
  phoneNumber?: string;
}
