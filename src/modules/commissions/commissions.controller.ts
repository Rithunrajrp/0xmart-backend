import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
  ApiQuery,
} from '@nestjs/swagger';
import { CommissionsService } from './commissions.service';
import { ApiKeyGuard } from '../api-keys/guards/api-key.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import {
  RequestPayoutDto,
  UpdatePayoutWalletDto,
  GetCommissionHistoryDto,
} from './dto/commission.dto';
import { CommissionStatus } from '@prisma/client';

@ApiTags('commissions')
@Controller('commissions')
@Public()
@UseGuards(ApiKeyGuard)
export class CommissionsController {
  constructor(private readonly commissionsService: CommissionsService) {}

  @Get('dashboard')
  @ApiOperation({
    summary: 'Get commission dashboard',
    description:
      'Get overview of your commissions including pending, available, and paid amounts',
  })
  @ApiHeader({ name: 'X-API-Key', description: 'API Key', required: true })
  @ApiResponse({
    status: 200,
    description: 'Commission dashboard',
    schema: {
      example: {
        summary: {
          commissionRate: '5%',
          totalEarnings: '1500.00',
          pendingEarnings: '250.00',
          availableEarnings: '500.00',
          payoutWallet: '0x1234...',
          payoutNetwork: 'POLYGON',
        },
        breakdown: {
          pending: { count: 5, amount: '250.00' },
          confirmed: { count: 3, amount: '150.00' },
          available: { count: 10, amount: '500.00' },
          paid: { count: 12, amount: '600.00' },
          cancelled: { count: 1, amount: '25.00' },
        },
        recentCommissions: [],
      },
    },
  })
  async getDashboard(@CurrentUser() user: { apiKeyId: string }) {
    return this.commissionsService.getCommissionDashboard(user.apiKeyId);
  }

  @Get('history')
  @ApiOperation({
    summary: 'Get commission history',
    description: 'Get detailed history of all your commissions',
  })
  @ApiHeader({ name: 'X-API-Key', description: 'API Key', required: true })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PENDING', 'CONFIRMED', 'AVAILABLE', 'PAID', 'CANCELLED'],
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Commission history' })
  async getHistory(
    @CurrentUser() user: { apiKeyId: string },
    @Query('status') status?: CommissionStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.commissionsService.getCommissionHistory(user.apiKeyId, {
      status,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('payouts')
  @ApiOperation({
    summary: 'Get payout history',
    description: 'Get history of all your commission payouts',
  })
  @ApiHeader({ name: 'X-API-Key', description: 'API Key', required: true })
  @ApiResponse({ status: 200, description: 'Payout history' })
  async getPayouts(@CurrentUser() user: { apiKeyId: string }) {
    return this.commissionsService.getPayoutHistory(user.apiKeyId);
  }

  @Post('payout')
  @ApiOperation({
    summary: 'Request commission payout',
    description: 'Request payout of available commissions to your wallet',
  })
  @ApiHeader({ name: 'X-API-Key', description: 'API Key', required: true })
  @ApiResponse({
    status: 200,
    description: 'Payout requested',
    schema: {
      example: {
        payoutId: 'uuid',
        amount: '500.00',
        currency: 'USDT',
        network: 'POLYGON',
        walletAddress: '0x1234...',
        status: 'PENDING',
        message:
          'Payout request submitted. Processing typically takes 1-3 business days.',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Insufficient balance or invalid request',
  })
  async requestPayout(
    @Body() dto: RequestPayoutDto,
    @CurrentUser() user: { apiKeyId: string },
  ) {
    return this.commissionsService.requestPayout(
      user.apiKeyId,
      dto.walletAddress,
      dto.network,
      dto.stablecoinType,
    );
  }

  @Patch('payout-wallet')
  @ApiOperation({
    summary: 'Update payout wallet',
    description: 'Update your default wallet address for commission payouts',
  })
  @ApiHeader({ name: 'X-API-Key', description: 'API Key', required: true })
  @ApiResponse({ status: 200, description: 'Wallet updated' })
  async updatePayoutWallet(
    @Body() dto: UpdatePayoutWalletDto,
    @CurrentUser() user: { apiKeyId: string },
  ) {
    return this.commissionsService.updatePayoutWallet(
      user.apiKeyId,
      dto.walletAddress,
      dto.network,
    );
  }
}
