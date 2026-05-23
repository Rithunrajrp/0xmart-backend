import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsDateString,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { StablecoinType } from '@prisma/client';

export class DateRangeFilterDto {
  @ApiProperty({ description: 'Start date (YYYY-MM-DD)' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: 'End date (YYYY-MM-DD)' })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({ enum: StablecoinType })
  @IsEnum(StablecoinType)
  @IsOptional()
  stablecoinType?: StablecoinType;
}

export class BalanceSheetFilterDto {
  @ApiProperty({ description: 'As of date (YYYY-MM-DD)' })
  @IsDateString()
  asOfDate: string;

  @ApiPropertyOptional({ enum: StablecoinType })
  @IsEnum(StablecoinType)
  @IsOptional()
  stablecoinType?: StablecoinType;

  @ApiPropertyOptional({ description: 'Compare with previous period' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  compareWithPrevious?: boolean;
}

export class RevenueAnalyticsFilterDto {
  @ApiProperty({ description: 'Start date (YYYY-MM-DD)' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: 'End date (YYYY-MM-DD)' })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({
    enum: ['DAY', 'WEEK', 'MONTH'],
    description: 'Group by period',
    default: 'DAY',
  })
  @IsString()
  @IsOptional()
  groupBy?: 'DAY' | 'WEEK' | 'MONTH';

  @ApiPropertyOptional({ enum: StablecoinType })
  @IsEnum(StablecoinType)
  @IsOptional()
  stablecoinType?: StablecoinType;
}

export class ReconciliationFilterDto {
  @ApiPropertyOptional({ description: 'Start date' })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date' })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ enum: ['MATCHED', 'DISCREPANCY', 'PENDING_REVIEW', 'RESOLVED'] })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsNumber()
  @Transform(({ value }) => parseInt(value) || 1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsNumber()
  @Transform(({ value }) => parseInt(value) || 20)
  @IsOptional()
  limit?: number;
}

export class CreateReconciliationDto {
  @ApiProperty({ description: 'Period start date' })
  @IsDateString()
  periodStart: string;

  @ApiProperty({ description: 'Period end date' })
  @IsDateString()
  periodEnd: string;

  @ApiProperty({ enum: StablecoinType })
  @IsEnum(StablecoinType)
  stablecoinType: StablecoinType;

  @ApiProperty({ description: 'System calculated balance' })
  @IsNumber()
  @Transform(({ value }) => parseFloat(value))
  systemBalance: number;

  @ApiProperty({ description: 'Actual blockchain balance' })
  @IsNumber()
  @Transform(({ value }) => parseFloat(value))
  actualBalance: number;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}
