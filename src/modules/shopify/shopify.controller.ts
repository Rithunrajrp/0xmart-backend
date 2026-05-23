import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Headers,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ShopifyService } from './shopify.service';
import {
  CreateShopifyMerchantDto,
  CreateShopifyProductDto,
  UpdateShopifyProductDto,
  UpdateFulfillmentDto,
} from './dto';
import { ShopifyApiKeyGuard } from './guards/shopify-api-key.guard';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Shopify Integration')
@Controller('shopify')
export class ShopifyController {
  constructor(private readonly shopifyService: ShopifyService) {}

  // ============================================
  // MERCHANT ENDPOINTS
  // ============================================

  @Post('merchants')
  @Public()
  @ApiOperation({
    summary: 'Create merchant from Shopify store',
    description:
      'Creates a new seller account linked to a Shopify store. Returns API credentials for future requests.',
  })
  @ApiResponse({
    status: 201,
    description: 'Merchant created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        email: { type: 'string' },
        storeName: { type: 'string' },
        apiKey: { type: 'string' },
        apiSecret: { type: 'string' },
        isNew: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  async createMerchant(@Body() dto: CreateShopifyMerchantDto) {
    return this.shopifyService.createMerchantFromShopify(dto);
  }

  @Get('merchants/by-shop/:shop')
  @Public()
  @ApiOperation({
    summary: 'Get merchant by Shopify shop domain',
  })
  @ApiParam({
    name: 'shop',
    description: 'Shopify shop domain (e.g., my-store.myshopify.com)',
  })
  @ApiResponse({ status: 200, description: 'Merchant found' })
  @ApiResponse({ status: 404, description: 'Merchant not found' })
  async getMerchantByShop(@Param('shop') shop: string) {
    return this.shopifyService.getMerchantByShop(shop);
  }

  // ============================================
  // PRODUCT ENDPOINTS
  // ============================================

  @Post('products')
  @UseGuards(ShopifyApiKeyGuard)
  @ApiOperation({
    summary: 'Create product from Shopify',
    description:
      'Creates a product on 0xMart linked to a Shopify product. Requires X-API-Key header.',
  })
  @ApiHeader({
    name: 'X-API-Key',
    description: 'Shopify store API key',
    required: true,
  })
  @ApiResponse({ status: 201, description: 'Product created' })
  @ApiResponse({ status: 400, description: 'Invalid API key' })
  @ApiResponse({ status: 409, description: 'Product already synced' })
  async createProduct(
    @Headers('x-api-key') apiKey: string,
    @Body() dto: CreateShopifyProductDto,
  ) {
    return this.shopifyService.createProduct(apiKey, dto);
  }

  @Patch('products/:id')
  @UseGuards(ShopifyApiKeyGuard)
  @ApiOperation({
    summary: 'Update product from Shopify',
  })
  @ApiHeader({
    name: 'X-API-Key',
    description: 'Shopify store API key',
    required: true,
  })
  @ApiParam({ name: 'id', description: '0xMart product ID' })
  @ApiResponse({ status: 200, description: 'Product updated' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async updateProduct(
    @Headers('x-api-key') apiKey: string,
    @Param('id') id: string,
    @Body() dto: UpdateShopifyProductDto,
  ) {
    return this.shopifyService.updateProduct(apiKey, id, dto);
  }

  @Delete('products/:id')
  @UseGuards(ShopifyApiKeyGuard)
  @ApiOperation({
    summary: 'Delete product (unlink from Shopify)',
  })
  @ApiHeader({
    name: 'X-API-Key',
    description: 'Shopify store API key',
    required: true,
  })
  @ApiParam({ name: 'id', description: '0xMart product ID' })
  @ApiResponse({ status: 200, description: 'Product deleted' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async deleteProduct(
    @Headers('x-api-key') apiKey: string,
    @Param('id') id: string,
  ) {
    await this.shopifyService.deleteProduct(apiKey, id);
    return { success: true };
  }

  // ============================================
  // ORDER ENDPOINTS
  // ============================================

  @Get('merchants/:merchantId/orders')
  @UseGuards(ShopifyApiKeyGuard)
  @ApiOperation({
    summary: 'Get orders for merchant',
    description:
      'Returns orders that contain products from this merchant. Used for fulfillment sync.',
  })
  @ApiHeader({
    name: 'X-API-Key',
    description: 'Shopify store API key',
    required: true,
  })
  @ApiParam({ name: 'merchantId', description: 'Merchant/Seller ID' })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by order status (e.g., PENDING_FULFILLMENT)',
  })
  @ApiResponse({ status: 200, description: 'Orders retrieved' })
  async getOrdersForMerchant(
    @Headers('x-api-key') apiKey: string,
    @Param('merchantId') merchantId: string,
    @Query('status') status?: string,
  ) {
    return this.shopifyService.getOrdersForMerchant(apiKey, merchantId, status);
  }

  @Patch('orders/:orderId/fulfillment')
  @UseGuards(ShopifyApiKeyGuard)
  @ApiOperation({
    summary: 'Update order fulfillment status',
    description:
      'Updates the fulfillment status of an order from Shopify fulfillment events.',
  })
  @ApiHeader({
    name: 'X-API-Key',
    description: 'Shopify store API key',
    required: true,
  })
  @ApiParam({ name: 'orderId', description: '0xMart order ID' })
  @ApiResponse({ status: 200, description: 'Fulfillment updated' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async updateOrderFulfillment(
    @Headers('x-api-key') apiKey: string,
    @Param('orderId') orderId: string,
    @Body() dto: UpdateFulfillmentDto,
  ) {
    await this.shopifyService.updateOrderFulfillment(apiKey, orderId, dto);
    return { success: true };
  }
}
