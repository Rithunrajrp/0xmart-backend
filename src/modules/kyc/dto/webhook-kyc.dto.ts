import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class KycWebhookDto {
  @IsString()
  @IsNotEmpty()
  applicantId: string;

  @IsString()
  @IsNotEmpty()
  reviewStatus: string;

  @IsString()
  @IsOptional()
  reviewRejectType?: string;

  @IsOptional()
  clientComment?: string;
}
