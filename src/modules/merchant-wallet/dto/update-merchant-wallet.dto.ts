import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, Matches } from 'class-validator';

export class UpdateMerchantWalletDto {
  @ApiPropertyOptional({
    description: 'Updated wallet address',
    example: '0x1234567890abcdef1234567890abcdef12345678',
  })
  @IsString()
  @IsOptional()
  @Matches(/^0x[a-fA-F0-9]{40}$|^[1-9A-HJ-NP-Za-km-z]{32,44}$/, {
    message: 'Invalid wallet address format',
  })
  walletAddress?: string;

  @ApiPropertyOptional({
    description: 'Label for the wallet',
    example: 'Primary USDT Wallet',
  })
  @IsString()
  @IsOptional()
  label?: string;

  @ApiPropertyOptional({
    description: 'Set as default wallet for this stablecoin',
  })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
