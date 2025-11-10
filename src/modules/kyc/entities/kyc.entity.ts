import { ApiProperty } from '@nestjs/swagger';
import { KYCStatus } from '@prisma/client';

export class KycDocumentEntity {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  documentType: string;

  @ApiProperty({ enum: KYCStatus })
  status: KYCStatus;

  @ApiProperty()
  submittedAt: Date;

  @ApiProperty()
  reviewedAt: Date | null;

  @ApiProperty()
  rejectionReason: string | null;
}

export class KycSessionEntity {
  @ApiProperty()
  sessionUrl: string;

  @ApiProperty()
  applicantId: string;

  @ApiProperty()
  expiresAt: string;
}
