import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateAdminDto {
  @ApiProperty({ description: 'Activate or deactivate admin', required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
