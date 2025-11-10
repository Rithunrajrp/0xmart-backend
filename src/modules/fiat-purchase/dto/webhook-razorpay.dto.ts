import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RazorpayWebhookDto {
  @IsString()
  @IsNotEmpty()
  event: string;

  @IsOptional()
  payload?: any;
}
