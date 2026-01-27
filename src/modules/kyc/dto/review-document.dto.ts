import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ReviewDocumentDto {
  @ApiProperty({
    example: true,
    description: 'Whether to approve or reject the document',
  })
  @IsBoolean()
  approve: boolean;

  @ApiProperty({
    example: 'Document is blurry and unreadable',
    required: false,
    description: 'Rejection reason (required if approve is false)',
  })
  @IsString()
  @IsOptional()
  rejectionReason?: string;
}
