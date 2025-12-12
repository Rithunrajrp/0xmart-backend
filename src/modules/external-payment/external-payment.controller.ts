import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { ExternalPaymentService } from './external-payment.service';
import { ApiKeyGuard } from '../api-keys/guards/api-key.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import {
  InitiatePaymentDto,
  VerifyExternalOtpDto,
  SubmitAddressDto,
  SelectNetworkDto,
  ConfirmExternalPaymentDto,
  ResendOtpDto,
} from './dto/initiate-payment.dto';

@ApiTags('external-payment')
@Controller('payment')
@Public()
@UseGuards(ApiKeyGuard)
export class ExternalPaymentController {
  private readonly logger = new Logger(ExternalPaymentController.name);

  constructor(private readonly paymentService: ExternalPaymentService) {}

  @Post('initiate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Initiate payment (402 Protocol)',
    description: `
      Step 1 of the 402 Payment Protocol.

      This endpoint checks customer status and determines required verification steps:
      - EMAIL_MISMATCH: Phone exists with different email
      - NEED_VERIFICATION: Email/phone OTP verification required
      - NEED_ADDRESS: Shipping address required
      - READY_FOR_PAYMENT: Customer verified, ready to pay
    `,
  })
  @ApiHeader({ name: 'X-API-Key', description: 'API Key', required: true })
  @ApiResponse({
    status: 200,
    description: 'Payment initiation response',
    schema: {
      example: {
        status: 'INITIATED',
        orderId: 'uuid',
        orderNumber: 'EXT-1234567890-0001',
        need: {
          emailVerification: true,
          phoneVerification: false,
          address: true,
          networkSelection: true,
        },
        customer: {
          email: 'jo***e@example.com',
          phone: '+91****10',
          emailVerified: false,
          phoneVerified: true,
          hasAddress: false,
        },
        product: {
          id: 'P123',
          name: 'Product Name',
          price: '54.99',
          currency: 'USDT',
        },
        suggestedNetworks: ['TON', 'SUI', 'POLYGON'],
        reason: 'New customer - verification required',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'EMAIL_MISMATCH or PHONE_MISMATCH',
    schema: {
      example: {
        error: 'EMAIL_MISMATCH',
        message:
          'Phone number already exists but associated with a different email',
        hint: 'Please use the email associated with this phone number',
      },
    },
  })
  async initiatePayment(
    @Body() dto: InitiatePaymentDto,
    @CurrentUser() user: { apiKeyId: string },
  ) {
    return this.paymentService.initiatePayment(user.apiKeyId, {
      productId: dto.productId,
      quantity: dto.quantity || 1,
      phone: dto.phone,
      email: dto.email,
      stablecoinType: dto.stablecoinType,
      network: dto.network,
      adClickToken: dto.adClickToken,
      idempotencyKey: dto.idempotencyKey,
    });
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify OTP',
    description: 'Step 2: Verify email or phone OTP',
  })
  @ApiHeader({ name: 'X-API-Key', description: 'API Key', required: true })
  @ApiResponse({
    status: 200,
    description: 'OTP verified',
    schema: {
      example: {
        success: true,
        nextStep: 'SUBMIT_ADDRESS', // or 'SELECT_NETWORK' or 'READY_FOR_PAYMENT'
      },
    },
  })
  async verifyOtp(
    @Body() dto: VerifyExternalOtpDto,
    @CurrentUser() user: { apiKeyId: string },
  ) {
    return this.paymentService.verifyOtp(
      user.apiKeyId,
      dto.orderId,
      dto.otp,
      dto.type,
    );
  }

  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resend OTP',
    description: 'Resend OTP to email or phone',
  })
  @ApiHeader({ name: 'X-API-Key', description: 'API Key', required: true })
  @ApiResponse({
    status: 200,
    description: 'OTP resent',
    schema: {
      example: {
        success: true,
        message: 'OTP sent to email',
      },
    },
  })
  async resendOtp(
    @Body() dto: ResendOtpDto,
    @CurrentUser() user: { apiKeyId: string },
  ) {
    return this.paymentService.resendOtp(user.apiKeyId, dto.orderId, dto.type);
  }

  @Post('submit-address')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Submit shipping address',
    description: 'Step 3: Submit shipping address for the order',
  })
  @ApiHeader({ name: 'X-API-Key', description: 'API Key', required: true })
  @ApiResponse({
    status: 200,
    description: 'Address submitted',
    schema: {
      example: {
        success: true,
        nextStep: 'SELECT_NETWORK', // or 'READY_FOR_PAYMENT'
      },
    },
  })
  async submitAddress(
    @Body() dto: SubmitAddressDto,
    @CurrentUser() user: { apiKeyId: string },
  ) {
    return this.paymentService.submitAddress(user.apiKeyId, dto.orderId, {
      fullName: dto.fullName,
      addressLine1: dto.addressLine1,
      addressLine2: dto.addressLine2,
      city: dto.city,
      state: dto.state,
      postalCode: dto.postalCode,
      country: dto.country,
      landmark: dto.landmark,
    });
  }

  @Post('select-network')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Select payment network',
    description: 'Step 4: Select blockchain network and get deposit address',
  })
  @ApiHeader({ name: 'X-API-Key', description: 'API Key', required: true })
  @ApiResponse({
    status: 200,
    description: 'Network selected, deposit address generated',
    schema: {
      example: {
        success: true,
        payment: {
          depositAddress: '0x1234...',
          amount: '54.99',
          currency: 'USDT',
          network: 'TON',
          expiresAt: '2024-01-02T00:00:00Z',
          qrData: '{"address":"0x...","amount":"54.99",...}',
        },
      },
    },
  })
  async selectNetwork(
    @Body() dto: SelectNetworkDto,
    @CurrentUser() user: { apiKeyId: string },
  ) {
    return this.paymentService.selectNetwork(
      user.apiKeyId,
      dto.orderId,
      dto.network,
    );
  }

  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirm payment',
    description: 'Step 5: Submit transaction hash to confirm payment',
  })
  @ApiHeader({ name: 'X-API-Key', description: 'API Key', required: true })
  @ApiResponse({
    status: 200,
    description: 'Payment confirmation initiated',
    schema: {
      example: {
        success: true,
        order: {
          id: 'uuid',
          orderNumber: 'EXT-1234567890-0001',
          status: 'PAYMENT_DETECTED',
          total: '54.99',
        },
      },
    },
  })
  async confirmPayment(
    @Body() dto: ConfirmExternalPaymentDto,
    @CurrentUser() user: { apiKeyId: string },
  ) {
    return this.paymentService.confirmPayment(
      user.apiKeyId,
      dto.orderId,
      dto.txHash,
    );
  }

  @Get('status/:orderId')
  @ApiOperation({
    summary: 'Get order status',
    description: 'Get current status and details of an order',
  })
  @ApiHeader({ name: 'X-API-Key', description: 'API Key', required: true })
  @ApiResponse({
    status: 200,
    description: 'Order status',
    schema: {
      example: {
        orderId: 'uuid',
        orderNumber: 'EXT-1234567890-0001',
        status: 'AWAITING_PAYMENT',
        product: { id: 'P123' },
        pricing: {
          subtotal: '49.99',
          tax: '5.00',
          total: '54.99',
          currency: 'USDT',
        },
        payment: {
          depositAddress: '0x1234...',
          network: 'TON',
          expectedAmount: '54.99',
          expiresAt: '2024-01-02T00:00:00Z',
        },
        shipping: {
          fullName: 'John Doe',
          city: 'New York',
          country: 'USA',
        },
        customer: {
          emailVerified: true,
          phoneVerified: true,
          hasAddress: true,
        },
        createdAt: '2024-01-01T00:00:00Z',
        expiresAt: '2024-01-02T00:00:00Z',
      },
    },
  })
  async getOrderStatus(
    @Param('orderId') orderId: string,
    @CurrentUser() user: { apiKeyId: string },
  ) {
    return this.paymentService.getOrderStatus(user.apiKeyId, orderId);
  }
}
