import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsIn } from 'class-validator';

export class UploadDocumentDto {
  @ApiProperty({ example: 'abc123token...', description: 'Onboarding token' })
  @IsString()
  @IsNotEmpty()
  onboardingToken: string;

  @ApiProperty({
    example: 'gst_certificate',
    description: 'Document type',
    enum: [
      'gst_certificate',
      'pan_card',
      'cin_certificate',
      'msme_certificate',
      'bank_statement',
      'business_license',
      'identity_proof',
    ],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn([
    'gst_certificate',
    'pan_card',
    'cin_certificate',
    'msme_certificate',
    'bank_statement',
    'business_license',
    'identity_proof',
  ])
  documentType: string;

  @ApiProperty({
    example: 'gst-certificate.pdf',
    description: 'Original file name',
  })
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @ApiProperty({
    example: 'https://s3.amazonaws.com/...',
    description: 'Document URL',
  })
  @IsString()
  @IsNotEmpty()
  documentUrl: string;

  @ApiProperty({
    example: 'application/pdf',
    description: 'MIME type',
    required: false,
  })
  @IsString()
  mimeType?: string;

  @ApiProperty({
    example: 1024000,
    description: 'File size in bytes',
    required: false,
  })
  fileSize?: number;
}
