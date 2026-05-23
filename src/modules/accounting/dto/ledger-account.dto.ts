import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsNumber,
} from 'class-validator';
import { Transform } from 'class-transformer';

export enum LedgerAccountType {
  ASSET = 'ASSET',
  LIABILITY = 'LIABILITY',
  EQUITY = 'EQUITY',
  REVENUE = 'REVENUE',
  EXPENSE = 'EXPENSE',
  CONTRA_ASSET = 'CONTRA_ASSET',
  CONTRA_LIABILITY = 'CONTRA_LIABILITY',
  CONTRA_REVENUE = 'CONTRA_REVENUE',
}

export class CreateLedgerAccountDto {
  @ApiProperty({ description: 'Unique account code (e.g., 1000, 2000)' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ description: 'Account name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: LedgerAccountType, description: 'Account type' })
  @IsEnum(LedgerAccountType)
  type: LedgerAccountType;

  @ApiPropertyOptional({ description: 'Account description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Parent account code for hierarchy' })
  @IsString()
  @IsOptional()
  parentCode?: string;

  @ApiPropertyOptional({ description: 'Display order within parent', default: 0 })
  @IsNumber()
  @Transform(({ value }) => parseInt(value) || 0)
  @IsOptional()
  displayOrder?: number;
}

export class UpdateLedgerAccountDto {
  @ApiPropertyOptional({ description: 'Account name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Account description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Is account active' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Display order within parent' })
  @IsNumber()
  @Transform(({ value }) => parseInt(value) || 0)
  @IsOptional()
  displayOrder?: number;
}

export class AccountBalanceFilterDto {
  @ApiPropertyOptional({ description: 'As of date (defaults to now)' })
  @IsString()
  @IsOptional()
  asOfDate?: string;

  @ApiPropertyOptional({ enum: LedgerAccountType })
  @IsEnum(LedgerAccountType)
  @IsOptional()
  accountType?: LedgerAccountType;

  @ApiPropertyOptional({ description: 'Include zero balance accounts' })
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsOptional()
  includeZeroBalance?: boolean;
}
