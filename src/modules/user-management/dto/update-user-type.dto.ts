import { IsEnum, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserType } from '@prisma/client';

export class UpdateUserTypeDto {
  @ApiProperty({
    enum: UserType,
    description: 'New user type to assign',
  })
  @IsEnum(UserType)
  userType: UserType;

  @ApiProperty({ description: 'Reason for change (optional)', required: false })
  @IsString()
  reason?: string;
}
