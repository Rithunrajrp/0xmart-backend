import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export class ApproveSettlementDto {
  @ApiPropertyOptional({ description: 'Notes for approval' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class RejectSettlementDto {
  @ApiProperty({ description: 'Reason for rejection' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class ProcessSettlementDto {
  @ApiPropertyOptional({ description: 'Override wallet address (admin only)' })
  @IsString()
  @IsOptional()
  overrideWalletAddress?: string;
}

export class ConfirmSettlementDto {
  @ApiProperty({ description: 'Blockchain transaction hash' })
  @IsString()
  @IsNotEmpty()
  txHash: string;

  @ApiPropertyOptional({ description: 'Block number of the transaction' })
  @IsString()
  @IsOptional()
  blockNumber?: string;
}

export class CancelSettlementDto {
  @ApiProperty({ description: 'Reason for cancellation' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class HoldSettlementDto {
  @ApiProperty({ description: 'Reason for putting on hold' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class ReleaseHoldDto {
  @ApiPropertyOptional({ description: 'Notes for releasing hold' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class BulkSettlementActionDto {
  @ApiProperty({ description: 'List of settlement IDs to process' })
  @IsString({ each: true })
  @IsNotEmpty()
  settlementIds: string[];

  @ApiProperty({
    enum: ['APPROVE', 'REJECT', 'HOLD', 'CANCEL'],
    description: 'Action to perform',
  })
  @IsEnum(['APPROVE', 'REJECT', 'HOLD', 'CANCEL'])
  action: 'APPROVE' | 'REJECT' | 'HOLD' | 'CANCEL';

  @ApiPropertyOptional({ description: 'Reason/notes for the action' })
  @IsString()
  @IsOptional()
  reason?: string;
}
