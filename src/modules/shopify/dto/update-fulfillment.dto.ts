import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class UpdateFulfillmentDto {
  @ApiProperty({
    description: 'Fulfillment status',
    example: 'FULFILLED',
  })
  @IsString()
  @IsNotEmpty()
  fulfillmentStatus: string;

  @ApiProperty({
    description: 'Tracking number',
    example: '1Z999AA10123456784',
    required: false,
  })
  @IsString()
  @IsOptional()
  trackingNumber?: string;

  @ApiProperty({
    description: 'Tracking URL',
    example: 'https://ups.com/track/...',
    required: false,
  })
  @IsString()
  @IsOptional()
  trackingUrl?: string;
}
