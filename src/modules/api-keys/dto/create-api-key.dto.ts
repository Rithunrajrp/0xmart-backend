import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsUrl,
  IsEnum,
  IsArray,
  ArrayMinSize,
} from 'class-validator';

export class CreateApiKeyDto {
  @ApiProperty({
    example: 'My Production API Key',
    description: 'A friendly name for the API key',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: ['ETHEREUM', 'POLYGON', 'SUI', 'TON'],
    description:
      'Array of blockchain networks this API key will support for payments',
    type: [String],
    enum: [
      'ETHEREUM',
      'POLYGON',
      'BSC',
      'ARBITRUM',
      'OPTIMISM',
      'AVALANCHE',
      'BASE',
      'SUI',
      'TON',
      'SOLANA',
    ],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one network must be selected' })
  @IsEnum(
    [
      'ETHEREUM',
      'POLYGON',
      'BSC',
      'ARBITRUM',
      'OPTIMISM',
      'AVALANCHE',
      'BASE',
      'SUI',
      'TON',
      'SOLANA',
    ],
    { each: true },
  )
  supportedNetworks: string[];

  @ApiProperty({
    example: 90,
    description: 'Number of days until the API key expires (optional)',
    required: false,
  })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(365)
  expiresInDays?: number;

  @ApiProperty({
    example: 'free',
    description: 'Subscription tier (free, basic, pro, enterprise)',
    required: false,
    enum: ['free', 'basic', 'pro', 'enterprise'],
  })
  @IsString()
  @IsOptional()
  @IsEnum(['free', 'basic', 'pro', 'enterprise'])
  subscriptionTier?: string;

  @ApiProperty({
    example: 'https://example.com/webhook',
    description: 'Webhook URL for event notifications',
    required: false,
  })
  @IsUrl()
  @IsOptional()
  webhookUrl?: string;
}

export class UpdateWebhookDto {
  @ApiProperty({
    example: 'https://example.com/webhook',
    description: 'Webhook URL for event notifications (null to remove)',
    required: false,
  })
  @IsUrl()
  @IsOptional()
  webhookUrl?: string | null;
}

export class UpdateTierDto {
  @ApiProperty({
    example: 'pro',
    description: 'Subscription tier',
    enum: ['free', 'basic', 'pro', 'enterprise'],
  })
  @IsString()
  @IsNotEmpty()
  @IsEnum(['free', 'basic', 'pro', 'enterprise'])
  tier: string;
}
