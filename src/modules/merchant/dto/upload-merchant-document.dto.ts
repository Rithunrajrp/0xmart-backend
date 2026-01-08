import { IsString, IsEnum, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UploadMerchantDocumentDto {
  @ApiProperty({
    example: 'business_license',
    enum: ['business_license', 'tax_certificate', 'identity_proof', 'bank_statement'],
    description: 'Type of document being uploaded'
  })
  @IsEnum(['business_license', 'tax_certificate', 'identity_proof', 'bank_statement'])
  documentType: string;

  @ApiProperty({ example: 'business_license.pdf' })
  @IsString()
  fileName: string;

  @ApiProperty({ example: 'https://s3.amazonaws.com/...' })
  @IsString()
  documentUrl: string;

  @ApiProperty({ example: 'application/pdf' })
  @IsString()
  mimeType: string;

  @ApiProperty({ example: 1024000 })
  @IsNumber()
  fileSize: number;
}
