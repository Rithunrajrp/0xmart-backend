import * as common from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { FiatPurchaseService } from './fiat-purchase.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UserRole, FiatPaymentStatus } from '@prisma/client';
import {
  FiatPurchaseEntity,
  CreatePurchaseResponseEntity,
} from './entities/purchase.entity';
import { StripeService } from './services/stripe.service';
import { RazorpayService } from './services/razorpay.service';
import { Request } from 'express';

@ApiTags('fiat-purchase')
@common.Controller('fiat-purchase')
export class FiatPurchaseController {
  constructor(
    private readonly fiatPurchaseService: FiatPurchaseService,
    private readonly stripeService: StripeService,
    private readonly razorpayService: RazorpayService,
  ) {}

  @ApiBearerAuth()
  @common.UseGuards(JwtAuthGuard)
  @common.Post()
  @ApiOperation({ summary: 'Initiate fiat to stablecoin purchase' })
  @ApiResponse({ status: 201, type: CreatePurchaseResponseEntity })
  async createPurchase(
    @CurrentUser() user: any,
    @common.Body() createPurchaseDto: CreatePurchaseDto,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return this.fiatPurchaseService.createPurchase(user.id, createPurchaseDto);
  }

  @ApiBearerAuth()
  @common.UseGuards(JwtAuthGuard)
  @common.Get()
  @ApiOperation({ summary: 'Get purchase history' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200 })
  async getPurchaseHistory(
    @CurrentUser() user: any,
    @common.Query('page') page?: number,
    @common.Query('limit') limit?: number,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return this.fiatPurchaseService.getPurchaseHistory(user.id, page, limit);
  }

  @ApiBearerAuth()
  @common.UseGuards(JwtAuthGuard)
  @common.Get(':id')
  @ApiOperation({ summary: 'Get purchase by ID' })
  @ApiResponse({ status: 200, type: FiatPurchaseEntity })
  async getPurchase(@common.Param('id') id: string, @CurrentUser() user: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return this.fiatPurchaseService.getPurchaseById(id, user.id);
  }

  // Webhook endpoints
  @Public()
  @common.Post('webhook/stripe')
  @ApiOperation({ summary: 'Stripe webhook endpoint' })
  async handleStripeWebhook(
    @common.Headers('stripe-signature') signature: string,
    @common.Req() request: common.RawBodyRequest<Request>,
  ) {
    const event = this.stripeService.handleWebhook(
      signature,
      request.rawBody as Buffer,
    );
    return this.fiatPurchaseService.handleStripeWebhook(event);
  }

  @Public()
  @common.Post('webhook/razorpay')
  @ApiOperation({ summary: 'Razorpay webhook endpoint' })
  async handleRazorpayWebhook(
    @common.Headers('x-razorpay-signature') signature: string,
    @common.Body() body: any,
  ) {
    const isValid = this.razorpayService.verifyWebhookSignature(
      signature,
      JSON.stringify(body),
    );

    if (!isValid) {
      throw new Error('Invalid webhook signature');
    }

    return this.fiatPurchaseService.handleRazorpayWebhook(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      body.event,
      body.payload,
    );
  }

  // Admin routes
  @ApiBearerAuth()
  @common.UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @common.Get('admin/all')
  @ApiOperation({ summary: 'Get all purchases (Admin only)' })
  @ApiQuery({ name: 'status', required: false, enum: FiatPaymentStatus })
  @ApiQuery({ name: 'provider', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200 })
  async getAllPurchases(
    @common.Query('status') status?: FiatPaymentStatus,
    @common.Query('provider') provider?: string,
    @common.Query('page') page?: number,
    @common.Query('limit') limit?: number,
  ) {
    return this.fiatPurchaseService.getAllPurchases({
      status,
      provider,
      page,
      limit,
    });
  }

  @ApiBearerAuth()
  @common.UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @common.Post('admin/:id/refund')
  @ApiOperation({ summary: 'Refund purchase (Admin only)' })
  @ApiResponse({ status: 200 })
  async refundPurchase(
    @common.Param('id') id: string,
    @CurrentUser() admin: any,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return this.fiatPurchaseService.refundPurchase(id, admin.id);
  }
}
