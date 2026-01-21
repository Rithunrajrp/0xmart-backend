import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TonPaymentService } from './ton-payment.service';
import {
  GetTonPaymentParamsDto,
  ConfirmTonPaymentDto,
  TonPaymentConfirmationResponse,
} from './dto/ton-payment.dto';

@ApiTags('TON Payment')
@Controller('payment')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TonPaymentController {
  constructor(private readonly tonPaymentService: TonPaymentService) {}

  @Get('params/:orderId')
  @ApiOperation({
    summary: 'Get TON smart contract payment parameters for an order',
    description:
      'Returns the TON contract address, amount in nanotons, and payload needed for the frontend to initiate a TON payment',
  })
  @ApiParam({
    name: 'orderId',
    description: 'Order ID',
    example: 'clx123abc...',
  })
  @ApiResponse({
    status: 200,
    description: 'TON payment parameters retrieved successfully',
    type: GetTonPaymentParamsDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Order not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Order is not in PAYMENT_PENDING status',
  })
  async getPaymentParams(
    @Param('orderId') orderId: string,
  ): Promise<GetTonPaymentParamsDto> {
    return this.tonPaymentService.getPaymentParams(orderId);
  }

  @Post('confirm/:orderId')
  @ApiOperation({
    summary: 'Confirm TON payment with transaction hash',
    description:
      'After user sends TON payment, frontend calls this endpoint with the transaction hash to confirm payment',
  })
  @ApiParam({
    name: 'orderId',
    description: 'Order ID',
    example: 'clx123abc...',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment confirmed successfully',
    type: TonPaymentConfirmationResponse,
  })
  @ApiResponse({
    status: 404,
    description: 'Order not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Order is not in PAYMENT_PENDING status',
  })
  async confirmPayment(
    @Param('orderId') orderId: string,
    @Body() dto: ConfirmTonPaymentDto,
  ): Promise<TonPaymentConfirmationResponse> {
    return this.tonPaymentService.confirmPayment(orderId, dto);
  }
}
