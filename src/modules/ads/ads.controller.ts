import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { AdsService } from './ads.service';
import { ApiKeyGuard } from '../api-keys/guards/api-key.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import {
  GetRecommendationsDto,
  AdClickOpenDto,
} from './dto/get-recommendations.dto';

@ApiTags('ads')
@Controller('ads')
@Public()
@UseGuards(ApiKeyGuard)
export class AdsController {
  private readonly logger = new Logger(AdsController.name);

  constructor(private readonly adsService: AdsService) {}

  @Post('get-recommendations')
  @ApiOperation({
    summary: 'Get product recommendations',
    description:
      'Get personalized product recommendations based on customer preferences',
  })
  @ApiHeader({
    name: 'X-API-Key',
    description: 'API Key for authentication',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Product recommendations',
    schema: {
      example: {
        status: true,
        count: 3,
        ads: [
          {
            productId: 'P123',
            title: 'Wireless Earbuds',
            description: 'High-quality wireless earbuds',
            thumbnail: 'https://...',
            prices: [{ currency: 'USDT', price: '49.99' }],
            stock: 100,
            adClickToken: 'click_abc123',
          },
        ],
      },
    },
  })
  async getRecommendations(
    @Body() dto: GetRecommendationsDto,
    @CurrentUser() user: { apiKeyId: string },
  ) {
    return this.adsService.getRecommendations(user.apiKeyId, {
      category: dto.category,
      priceRange: dto.priceRange,
      location: dto.location,
      userType: dto.userType,
      keywords: dto.keywords,
      customerSessionId: dto.customerSessionId,
      limit: dto.limit,
    });
  }

  @Post('open')
  @ApiOperation({
    summary: 'Open ad / Get product details',
    description:
      'When customer clicks an ad, call this endpoint to get full product details',
  })
  @ApiHeader({
    name: 'X-API-Key',
    description: 'API Key for authentication',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Full product details',
    schema: {
      example: {
        status: true,
        product: {
          id: 'P123',
          name: 'Wireless Earbuds',
          description: 'High-quality wireless earbuds with noise cancellation',
          thumbnail: 'https://...',
          images: ['https://...', 'https://...'],
          category: 'electronics',
          stock: 100,
          prices: [{ currency: 'USDT', price: '49.99' }],
        },
        purchaseInfo: {
          adClickToken: 'click_abc123',
          availableNetworks: ['TON', 'SUI', 'POLYGON'],
          acceptedStablecoins: ['USDT', 'USDC'],
          initiateEndpoint: '/api/v1/payment/initiate',
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Invalid or expired click token' })
  async openAd(
    @Body() dto: AdClickOpenDto,
    @CurrentUser() user: { apiKeyId: string },
  ) {
    return this.adsService.openAd(user.apiKeyId, dto.adClickToken);
  }

  @Get('analytics')
  @ApiOperation({
    summary: 'Get ad analytics',
    description: 'Get analytics for ad performance',
  })
  @ApiHeader({
    name: 'X-API-Key',
    description: 'API Key for authentication',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Ad analytics',
    schema: {
      example: {
        period: '30 days',
        metrics: {
          totalImpressions: 1000,
          totalClicks: 150,
          conversions: 25,
          clickThroughRate: '15.00%',
          conversionRate: '16.67%',
        },
        topProducts: [
          {
            productId: 'P123',
            name: 'Wireless Earbuds',
            category: 'electronics',
            clicks: 50,
          },
        ],
      },
    },
  })
  async getAnalytics(
    @Query('days') days: string,
    @CurrentUser() user: { apiKeyId: string },
  ) {
    return this.adsService.getAdAnalytics(
      user.apiKeyId,
      days ? parseInt(days, 10) : 30,
    );
  }
}
