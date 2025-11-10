import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class StripeWebhookDto {
  @IsString()
  @IsNotEmpty()
  type: string;

  @IsOptional()
  data?: any;
}
