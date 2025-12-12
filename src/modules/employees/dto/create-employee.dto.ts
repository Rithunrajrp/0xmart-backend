import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsArray,
  IsString,
} from 'class-validator';
import { EmployeeRole, EmployeePermission } from '@prisma/client';

export class CreateEmployeeDto {
  @ApiProperty({ description: 'Employee email (must be @0xmart.com)' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Employee phone number with country code' })
  @IsString()
  phoneNumber: string;

  @ApiProperty({ description: 'Country code (e.g., +1, +91)' })
  @IsString()
  countryCode: string;

  @ApiProperty({ enum: EmployeeRole, description: 'Employee role' })
  @IsEnum(EmployeeRole)
  role: EmployeeRole;

  @ApiProperty({
    type: [String],
    enum: EmployeePermission,
    description: 'Array of permissions',
  })
  @IsArray()
  @IsEnum(EmployeePermission, { each: true })
  permissions: EmployeePermission[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  department?: string;
}
