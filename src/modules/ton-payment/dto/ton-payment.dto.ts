import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class GetTonPaymentParamsDto {
  @ApiProperty({
    description: 'TON smart contract address to send payment to',
    example: 'EQD1_2...',
  })
  contractAddress: string;

  @ApiProperty({
    description: 'Payment amount in nanotons',
    example: '1000000000',
  })
  amount: string;

  @ApiProperty({
    description: 'Transaction payload (comment or data)',
    example: 'Payment for order ORD-123',
  })
  payload: string;

  @ApiProperty({
    description: 'Stablecoin type',
    example: 'USDT',
  })
  stablecoinType: string;

  @ApiProperty({
    description: 'Network',
    example: 'TON',
  })
  network: string;

  @ApiProperty({
    description: 'Order total amount in stablecoin',
    example: '50.00',
  })
  totalAmount: string;
}

export class ConfirmTonPaymentDto {
  @ApiProperty({
    description: 'Transaction hash from TON blockchain',
    example: 'abc123...',
  })
  @IsString()
  @IsNotEmpty()
  transactionHash: string;
}

export class TonPaymentConfirmationResponse {
  @ApiProperty({
    description: 'Order ID',
    example: 'clx123...',
  })
  orderId: string;

  @ApiProperty({
    description: 'Order number',
    example: 'ORD-123',
  })
  orderNumber: string;

  @ApiProperty({
    description: 'Order status',
    example: 'PAYMENT_PENDING',
  })
  status: string;

  @ApiProperty({
    description: 'Transaction hash',
    example: 'abc123...',
  })
  transactionHash: string;

  @ApiProperty({
    description: 'Message',
    example: 'Payment confirmation received. Awaiting blockchain confirmation.',
  })
  message: string;
}
