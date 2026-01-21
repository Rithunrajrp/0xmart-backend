import { Controller, Get, Put, Post, Patch, Query, Body, UseGuards } from '@nestjs/common';
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
import { UpdateMerchantProfileDto } from './dto/update-merchant-profile.dto';
import { UploadMerchantDocumentDto } from './dto/upload-merchant-document.dto';
import { CreateMerchantProductDto } from './dto/create-product.dto';
import { UpdateMerchantProductDto } from './dto/update-product.dto';
import { Param, Delete } from '@nestjs/common';

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

  @Get('revenue')
  @ApiOperation({ summary: 'Get merchant revenue analytics' })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Start date for revenue analysis (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'End date for revenue analysis (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'groupBy',
    required: false,
    enum: ['day', 'week', 'month'],
    description: 'Group revenue by day, week, or month (default: month)',
  })
  @ApiResponse({ status: 200, description: 'Returns revenue analytics' })
  @ApiResponse({ status: 404, description: 'Merchant profile not found' })
  async getRevenue(
    @CurrentUser() user: { id: string },
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('groupBy') groupBy?: 'day' | 'week' | 'month',
  ) {
    return this.merchantService.getMerchantRevenue(user.id, {
      startDate,
      endDate,
      groupBy,
    });
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

  @Get('products')
  @ApiOperation({ summary: 'Get merchant products' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 10)',
  })
  @ApiResponse({ status: 200, description: 'Returns merchant products' })
  @ApiResponse({ status: 404, description: 'Merchant profile not found' })
  async getProducts(
    @CurrentUser() user: { id: string },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.merchantService.getMerchantProducts(user.id, pageNum, limitNum);
  }

  @Post('products')
  @ApiOperation({ summary: 'Create a new product' })
  @ApiResponse({ status: 201, description: 'Product created successfully' })
  @ApiResponse({ status: 404, description: 'Merchant profile not found' })
  async createProduct(
    @CurrentUser() user: { id: string },
    @Body() createProductDto: CreateMerchantProductDto,
  ) {
    return this.merchantService.createMerchantProduct(user.id, createProductDto);
  }

  @Patch('products/:id')
  @ApiOperation({ summary: 'Update an existing product' })
  @ApiResponse({ status: 200, description: 'Product updated successfully' })
  @ApiResponse({ status: 404, description: 'Product not found or access denied' })
  async updateProduct(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() updateProductDto: UpdateMerchantProductDto,
  ) {
    return this.merchantService.updateMerchantProduct(user.id, id, updateProductDto);
  }

  @Delete('products/:id')
  @ApiOperation({ summary: 'Delete a product' })
  @ApiResponse({ status: 200, description: 'Product deleted successfully' })
  @ApiResponse({ status: 404, description: 'Product not found or access denied' })
  async deleteProduct(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.merchantService.deleteMerchantProduct(user.id, id);
  }

  @Get('profile')
  @ApiOperation({ summary: 'Get merchant profile with status' })
  @ApiResponse({ status: 200, description: 'Returns merchant profile details' })
  @ApiResponse({ status: 404, description: 'Merchant profile not found' })
  async getProfile(@CurrentUser() user: { id: string }) {
    return this.merchantService.getMerchantProfile(user.id);
  }

  @Put('profile')
  @ApiOperation({ summary: 'Update merchant profile with company details' })
  @ApiResponse({ status: 200, description: 'Merchant profile updated successfully' })
  @ApiResponse({ status: 404, description: 'Merchant profile not found' })
  @ApiResponse({ status: 400, description: 'Cannot update profile in current status' })
  async updateProfile(
    @CurrentUser() user: { id: string },
    @Body() updateProfileDto: UpdateMerchantProfileDto,
  ) {
    return this.merchantService.updateMerchantProfile(user.id, updateProfileDto);
  }

  @Patch('online-presence')
  @ApiOperation({ summary: 'Update merchant online presence (website, logo, banner)' })
  @ApiResponse({ status: 200, description: 'Online presence updated successfully' })
  @ApiResponse({ status: 404, description: 'Merchant profile not found' })
  async updateOnlinePresence(
    @CurrentUser() user: { id: string },
    @Body() updateDto: any,
  ) {
    return this.merchantService.updateOnlinePresence(user.id, updateDto);
  }

  @Get('documents')
  @ApiOperation({ summary: 'Get merchant uploaded documents' })
  @ApiResponse({ status: 200, description: 'Returns merchant documents' })
  @ApiResponse({ status: 404, description: 'Merchant profile not found' })
  async getDocuments(@CurrentUser() user: { id: string }) {
    return this.merchantService.getMerchantDocuments(user.id);
  }

  @Post('documents')
  @ApiOperation({ summary: 'Upload a document for merchant onboarding' })
  @ApiResponse({ status: 200, description: 'Document uploaded successfully' })
  @ApiResponse({ status: 404, description: 'Merchant profile not found' })
  @ApiResponse({ status: 400, description: 'Cannot upload documents in current status' })
  async uploadDocument(
    @CurrentUser() user: { id: string },
    @Body() uploadDocumentDto: UploadMerchantDocumentDto,
  ) {
    return this.merchantService.uploadMerchantDocument(user.id, uploadDocumentDto);
  }

  @Post('documents/submit')
  @ApiOperation({ summary: 'Submit all documents for review' })
  @ApiResponse({ status: 200, description: 'Documents submitted for review successfully' })
  @ApiResponse({ status: 404, description: 'Merchant profile not found' })
  @ApiResponse({ status: 400, description: 'Missing required documents or wrong status' })
  async submitDocuments(@CurrentUser() user: { id: string }) {
    return this.merchantService.submitMerchantDocuments(user.id);
  }
}
