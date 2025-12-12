import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RejectDocumentDto {
  @ApiProperty({
    example:
      'Document is blurry and unreadable. Please upload a clearer image.',
    description: 'Reason for document rejection (required)',
  })
  @IsString()
  @IsNotEmpty()
  rejectionNote: string;
}
