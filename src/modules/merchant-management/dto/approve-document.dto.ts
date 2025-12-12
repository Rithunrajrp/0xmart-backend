import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ApproveDocumentDto {
  @ApiProperty({
    example: 'Document meets all requirements',
    description: 'Optional approval note',
  })
  @IsString()
  note?: string;
}
