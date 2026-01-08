import { IsString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum UpdateType {
  EMAIL = 'EMAIL',
  PHONE = 'PHONE',
}

export class InitiateProfileUpdateDto {
  @ApiProperty({
    description: 'Type of profile field to update',
    enum: UpdateType,
    example: UpdateType.EMAIL,
  })
  @IsEnum(UpdateType)
  updateType: UpdateType;
}
