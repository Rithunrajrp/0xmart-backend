import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { MerchantWalletService } from './merchant-wallet.service';
import { CreateMerchantWalletDto, UpdateMerchantWalletDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { StablecoinType } from '@prisma/client';

@ApiTags('Merchant Wallet')
@Controller('merchant/wallets')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class MerchantWalletController {
  constructor(private readonly merchantWalletService: MerchantWalletService) {}

  @Post()
  @Roles('MERCHANT')
  @ApiOperation({ summary: 'Add a wallet address for receiving settlements' })
  @ApiResponse({ status: 201, description: 'Wallet added successfully' })
  @ApiResponse({ status: 400, description: 'Invalid wallet address' })
  @ApiResponse({ status: 409, description: 'Wallet already exists' })
  async createWallet(
    @CurrentUser() user: any,
    @Body() dto: CreateMerchantWalletDto,
  ) {
    const sellerId = user.sellerProfile?.id;
    if (!sellerId) {
      throw new Error('Merchant profile not found');
    }
    return this.merchantWalletService.createWallet(sellerId, dto);
  }

  @Get()
  @Roles('MERCHANT')
  @ApiOperation({ summary: 'Get all wallet addresses' })
  @ApiResponse({ status: 200, description: 'List of wallets' })
  async getWallets(@CurrentUser() user: any) {
    const sellerId = user.sellerProfile?.id;
    if (!sellerId) {
      throw new Error('Merchant profile not found');
    }
    return this.merchantWalletService.getWallets(sellerId);
  }

  @Get('balance')
  @Roles('MERCHANT')
  @ApiOperation({ summary: 'Get merchant balance for all or specific stablecoin' })
  @ApiQuery({ name: 'stablecoin', required: false, enum: ['USDT', 'USDC'] })
  @ApiResponse({ status: 200, description: 'Merchant balance' })
  async getBalance(
    @CurrentUser() user: any,
    @Query('stablecoin') stablecoin?: StablecoinType,
  ) {
    const sellerId = user.sellerProfile?.id;
    if (!sellerId) {
      throw new Error('Merchant profile not found');
    }
    return this.merchantWalletService.getMerchantBalance(sellerId, stablecoin);
  }

  @Get('earnings-summary')
  @Roles('MERCHANT')
  @ApiOperation({ summary: 'Get comprehensive earnings summary' })
  @ApiResponse({ status: 200, description: 'Earnings summary with balances, wallets, and recent settlements' })
  async getEarningsSummary(@CurrentUser() user: any) {
    const sellerId = user.sellerProfile?.id;
    if (!sellerId) {
      throw new Error('Merchant profile not found');
    }
    return this.merchantWalletService.getMerchantEarningsSummary(sellerId);
  }

  @Get('supported-networks')
  @Roles('MERCHANT')
  @ApiOperation({ summary: 'Get list of supported networks for settlement' })
  @ApiResponse({ status: 200, description: 'List of supported networks' })
  async getSupportedNetworks() {
    return this.merchantWalletService.getSupportedNetworks();
  }

  @Get('supported-stablecoins')
  @Roles('MERCHANT')
  @ApiOperation({ summary: 'Get list of supported stablecoins' })
  @ApiResponse({ status: 200, description: 'List of supported stablecoins' })
  async getSupportedStablecoins() {
    return this.merchantWalletService.getSupportedStablecoins();
  }

  @Get(':id')
  @Roles('MERCHANT')
  @ApiOperation({ summary: 'Get wallet by ID' })
  @ApiParam({ name: 'id', description: 'Wallet ID' })
  @ApiResponse({ status: 200, description: 'Wallet details' })
  @ApiResponse({ status: 404, description: 'Wallet not found' })
  async getWallet(@CurrentUser() user: any, @Param('id') walletId: string) {
    const sellerId = user.sellerProfile?.id;
    if (!sellerId) {
      throw new Error('Merchant profile not found');
    }
    return this.merchantWalletService.getWallet(sellerId, walletId);
  }

  @Put(':id')
  @Roles('MERCHANT')
  @ApiOperation({ summary: 'Update wallet address' })
  @ApiParam({ name: 'id', description: 'Wallet ID' })
  @ApiResponse({ status: 200, description: 'Wallet updated' })
  @ApiResponse({ status: 404, description: 'Wallet not found' })
  async updateWallet(
    @CurrentUser() user: any,
    @Param('id') walletId: string,
    @Body() dto: UpdateMerchantWalletDto,
  ) {
    const sellerId = user.sellerProfile?.id;
    if (!sellerId) {
      throw new Error('Merchant profile not found');
    }
    return this.merchantWalletService.updateWallet(sellerId, walletId, dto);
  }

  @Delete(':id')
  @Roles('MERCHANT')
  @ApiOperation({ summary: 'Delete wallet address' })
  @ApiParam({ name: 'id', description: 'Wallet ID' })
  @ApiResponse({ status: 200, description: 'Wallet deleted' })
  @ApiResponse({ status: 400, description: 'Cannot delete wallet with pending settlements' })
  @ApiResponse({ status: 404, description: 'Wallet not found' })
  async deleteWallet(@CurrentUser() user: any, @Param('id') walletId: string) {
    const sellerId = user.sellerProfile?.id;
    if (!sellerId) {
      throw new Error('Merchant profile not found');
    }
    return this.merchantWalletService.deleteWallet(sellerId, walletId);
  }
}
