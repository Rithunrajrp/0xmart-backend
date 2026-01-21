import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { OrderStatus } from '@prisma/client';
import {
  GetTonPaymentParamsDto,
  ConfirmTonPaymentDto,
  TonPaymentConfirmationResponse,
} from './dto/ton-payment.dto';

@Injectable()
export class TonPaymentService {
  private readonly logger = new Logger(TonPaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get TON payment parameters for an order
   */
  async getPaymentParams(orderId: string): Promise<GetTonPaymentParamsDto> {
    // Find the order
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Verify order is pending payment
    if (order.status !== OrderStatus.PAYMENT_PENDING) {
      throw new BadRequestException(
        `Order status is ${order.status}. Payment parameters only available for pending orders.`,
      );
    }

    // Get TON contract address from environment
    const tonContractAddress =
      this.configService.get<string>('TON_CONTRACT_ADDRESS') ||
      'EQD1_2_REPLACE_WITH_ACTUAL_CONTRACT_ADDRESS';

    // Get TON payment token addresses
    const tonUsdtAddress =
      this.configService.get<string>('TON_USDT_ADDRESS') ||
      'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c';
    const tonUsdcAddress =
      this.configService.get<string>('TON_USDC_ADDRESS') ||
      'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c';

    // Determine token address based on stablecoin type
    let tokenAddress = tonContractAddress;
    if (order.stablecoinType === 'USDT') {
      tokenAddress = tonUsdtAddress;
    } else if (order.stablecoinType === 'USDC') {
      tokenAddress = tonUsdcAddress;
    }

    // Convert amount to nanotons (TON uses 9 decimals)
    // For stablecoins, typically 6 decimals, so we multiply by 1e9 for nanotons
    const totalAmount = parseFloat(order.total.toString());
    const amountInNanotons = Math.floor(totalAmount * 1e9).toString();

    // Create payload (comment) for the transaction
    const payload = `0xMart Order: ${order.orderNumber}`;

    this.logger.log(
      `Generated TON payment parameters for order ${order.orderNumber}: ${totalAmount} ${order.stablecoinType}`,
    );

    return {
      contractAddress: tokenAddress,
      amount: amountInNanotons,
      payload,
      stablecoinType: order.stablecoinType,
      network: 'TON',
      totalAmount: totalAmount.toFixed(2),
    };
  }

  /**
   * Confirm TON payment with transaction hash
   */
  async confirmPayment(
    orderId: string,
    dto: ConfirmTonPaymentDto,
  ): Promise<TonPaymentConfirmationResponse> {
    const { transactionHash } = dto;

    // Find the order
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Verify order is pending payment
    if (order.status !== OrderStatus.PAYMENT_PENDING) {
      throw new BadRequestException(
        `Order status is ${order.status}. Cannot confirm payment for non-pending orders.`,
      );
    }

    // Update order with transaction hash
    // Note: Actual blockchain verification should be done by a listener service
    // For now, we just update the order with the transaction hash and status
    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        transactionHash,
        status: OrderStatus.CONFIRMED, // Change to CONFIRMED after tx hash provided
        paidAt: new Date(),
      },
    });

    this.logger.log(
      `Payment confirmed for order ${order.orderNumber} with tx hash: ${transactionHash}`,
    );

    // Create transaction record
    await this.prisma.transaction.create({
      data: {
        userId: order.userId,
        orderId: order.id,
        type: 'PURCHASE',
        status: 'COMPLETED',
        stablecoinType: order.stablecoinType,
        network: 'TON',
        amount: order.total,
        fee: 0,
        txHash: transactionHash,
      },
    });

    return {
      orderId: updatedOrder.id,
      orderNumber: updatedOrder.orderNumber,
      status: updatedOrder.status,
      transactionHash,
      message:
        'Payment confirmation received. Your order has been confirmed.',
    };
  }
}
