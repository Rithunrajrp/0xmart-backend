import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { MerchantService } from './merchant.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Merchant')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('merchant')
export class MerchantController {
  constructor(private readonly merchantService: MerchantService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get merchant dashboard stats' })
  @ApiResponse({ status: 200, description: 'Returns merchant statistics' })
  @ApiResponse({ status: 404, description: 'Merchant profile not found' })
  async getStats(@CurrentUser() user: { id: string }) {
    return this.merchantService.getMerchantStats(user.id);
  }

  @Get('orders')
  @ApiOperation({ summary: 'Get merchant orders' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of orders to return (default: 5)',
  })
  @ApiResponse({ status: 200, description: 'Returns merchant orders' })
  @ApiResponse({ status: 404, description: 'Merchant profile not found' })
  async getOrders(
    @CurrentUser() user: { id: string },
    @Query('limit') limit?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 5;
    return this.merchantService.getMerchantOrders(user.id, limitNum);
  }
}
