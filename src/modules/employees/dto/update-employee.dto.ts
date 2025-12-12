import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsArray,
  IsString,
} from 'class-validator';
import { EmployeeRole, EmployeePermission } from '@prisma/client';

export class UpdateEmployeeDto {
  @ApiProperty({ enum: EmployeeRole, required: false })
  @IsOptional()
  @IsEnum(EmployeeRole)
  role?: EmployeeRole;

  @ApiProperty({
    type: [String],
    enum: EmployeePermission,
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(EmployeePermission, { each: true })
  permissions?: EmployeePermission[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
