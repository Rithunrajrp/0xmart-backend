import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { DocumentType } from '@prisma/client';

export class UploadDocumentDto {
  @ApiProperty({
    enum: DocumentType,
    example: DocumentType.PASSPORT,
    description: 'Type of document being uploaded',
  })
  @IsEnum(DocumentType)
  documentType: DocumentType;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Front image of the document',
  })
  frontImage: any;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    required: false,
    description: 'Back image of the document (for two-sided documents like ID cards)',
  })
  @IsOptional()
  backImage?: any;

  @ApiProperty({
    example: 'AB123456',
    required: false,
    description: 'Document number if applicable',
  })
  @IsString()
  @IsOptional()
  documentNumber?: string;
}
