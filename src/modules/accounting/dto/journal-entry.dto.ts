import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsArray,
  IsNumber,
  ValidateNested,
  Min,
  IsUUID,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { StablecoinType } from '@prisma/client';

export class JournalEntryLineDto {
  @ApiProperty({ description: 'Ledger account code' })
  @IsString()
  @IsNotEmpty()
  accountCode: string;

  @ApiProperty({ description: 'Debit amount (0 if credit)' })
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => parseFloat(value) || 0)
  debitAmount: number;

  @ApiProperty({ description: 'Credit amount (0 if debit)' })
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => parseFloat(value) || 0)
  creditAmount: number;

  @ApiPropertyOptional({ description: 'Line description/memo' })
  @IsString()
  @IsOptional()
  description?: string;
}

export class CreateJournalEntryDto {
  @ApiPropertyOptional({ description: 'Reference type (ORDER, SETTLEMENT, ADJUSTMENT)' })
  @IsString()
  @IsOptional()
  referenceType?: string;

  @ApiPropertyOptional({ description: 'Reference ID (order ID, settlement ID, etc.)' })
  @IsString()
  @IsOptional()
  referenceId?: string;

  @ApiProperty({ enum: StablecoinType, description: 'Stablecoin for this entry' })
  @IsEnum(StablecoinType)
  stablecoinType: StablecoinType;

  @ApiProperty({ description: 'Description of the journal entry' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ type: [JournalEntryLineDto], description: 'Journal entry lines' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JournalEntryLineDto)
  lines: JournalEntryLineDto[];

  @ApiPropertyOptional({ description: 'Auto-post after creation' })
  @IsOptional()
  autoPost?: boolean;
}

export class JournalEntryFilterDto {
  @ApiPropertyOptional({ enum: StablecoinType })
  @IsEnum(StablecoinType)
  @IsOptional()
  stablecoinType?: StablecoinType;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  referenceType?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  endDate?: string;

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

export class PostJournalEntryDto {
  @ApiPropertyOptional({ description: 'Notes for posting' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class ReverseJournalEntryDto {
  @ApiProperty({ description: 'Reason for reversal' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
