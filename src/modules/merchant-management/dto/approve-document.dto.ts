import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ApproveDocumentDto {
  @ApiProperty({
    example: 'Document meets all requirements',
    description: 'Optional approval note',
  })
  @IsOptional()
  @IsString()
  note?: string;
}
