import { IsOptional, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateOnlinePresenceDto {
  @ApiProperty({ example: 'https://techcorp.com', required: false })
  @IsOptional()
  @IsUrl()
  website?: string;

  @ApiProperty({ example: 'https://example.com/logo.png', required: false })
  @IsOptional()
  @IsUrl()
  logo?: string;

  @ApiProperty({ example: 'https://example.com/banner.png', required: false })
  @IsOptional()
  @IsUrl()
  banner?: string;
}
