import { IsBoolean, IsOptional, IsString, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateSettingsDto {
  @ApiProperty({
    description: 'Enable or disable KYC verification requirement',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  kycEnabled?: boolean;

  @ApiProperty({
    description: 'Enable or disable maintenance mode',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  maintenanceMode?: boolean;

  @ApiProperty({
    description: 'Maintenance mode message',
    example: 'System under maintenance. We will be back soon.',
    required: false,
  })
  @IsOptional()
  @IsString()
  maintenanceMessage?: string;

  @ApiProperty({
    description: 'Enable or disable new user registrations',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  registrationEnabled?: boolean;

  @ApiProperty({
    description: 'Enable or disable withdrawals',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  withdrawalsEnabled?: boolean;

  @ApiProperty({
    description: 'Enable or disable deposits',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  depositsEnabled?: boolean;

  @ApiProperty({
    description: 'Enable or disable fiat purchases',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  fiatPurchaseEnabled?: boolean;

  @ApiProperty({
    description: 'Enable or disable token swap feature',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  tokenSwapEnabled?: boolean;

  @ApiProperty({
    description: 'Enable or disable API access for third-party developers',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  apiAccessEnabled?: boolean;

  @ApiProperty({
    description: 'Show or hide testnet banner',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  showTestnetBanner?: boolean;

  @ApiProperty({
    description: 'Minimum withdrawal amount',
    example: 10,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  minWithdrawalAmount?: number;

  @ApiProperty({
    description: 'Maximum withdrawal amount',
    example: 50000,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  maxWithdrawalAmount?: number;

  @ApiProperty({
    description: 'Withdrawal fee percentage',
    example: 0,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  withdrawalFeePercent?: number;
}
