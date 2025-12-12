import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
  ApiQuery,
} from '@nestjs/swagger';
import { SellersService } from './sellers.service';
import { ApiKeyGuard } from '../api-keys/guards/api-key.guard';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('sellers')
@Controller('sellers')
@Public()
@UseGuards(ApiKeyGuard)
export class SellersController {
  constructor(private readonly sellersService: SellersService) {}

  @Get()
  @ApiOperation({
    summary: 'List verified sellers',
    description: 'Get list of verified sellers/companies',
  })
  @ApiHeader({ name: 'X-API-Key', description: 'API Key', required: true })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'country', required: false, type: String })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: [
      'MANUFACTURER',
      'DISTRIBUTOR',
      'WHOLESALER',
      'RETAILER',
      'AGENCY',
      'BRAND',
      'INDIVIDUAL',
    ],
  })
  @ApiResponse({
    status: 200,
    description: 'List of sellers',
    schema: {
      example: {
        sellers: [
          {
            id: 'uuid',
            name: 'TechCorp Inc.',
            tradingName: 'TechCorp',
            type: 'MANUFACTURER',
            logo: 'https://...',
            location: 'San Francisco, USA',
            rating: '4.85',
            totalReviews: 1250,
            totalSales: 5000,
            productCount: 150,
          },
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 100,
          totalPages: 5,
        },
      },
    },
  })
  async listSellers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('country') country?: string,
    @Query('type') type?: string,
  ) {
    return this.sellersService.listVerifiedSellers({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      country,
      type,
    });
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get seller details',
    description: 'Get public information about a seller/company',
  })
  @ApiHeader({ name: 'X-API-Key', description: 'API Key', required: true })
  @ApiResponse({
    status: 200,
    description: 'Seller details',
    schema: {
      example: {
        id: 'uuid',
        name: 'TechCorp Inc.',
        tradingName: 'TechCorp',
        type: 'MANUFACTURER',
        isVerified: true,
        verifiedAt: '2024-01-01T00:00:00Z',
        logo: 'https://...',
        banner: 'https://...',
        description: 'Leading manufacturer of electronics...',
        website: 'https://techcorp.com',
        location: {
          city: 'San Francisco',
          state: 'CA',
          country: 'USA',
        },
        stats: {
          rating: '4.85',
          totalReviews: 1250,
          totalSales: 5000,
        },
        memberSince: '2023-01-01T00:00:00Z',
      },
    },
  })
  async getSellerDetails(@Param('id') id: string) {
    return this.sellersService.getSellerPublicInfo(id);
  }

  @Get(':id/products')
  @ApiOperation({
    summary: 'Get seller products',
    description: 'Get products from a specific seller',
  })
  @ApiHeader({ name: 'X-API-Key', description: 'API Key', required: true })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Seller products' })
  async getSellerProducts(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('category') category?: string,
  ) {
    return this.sellersService.getSellerProducts(id, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      category,
    });
  }
}
