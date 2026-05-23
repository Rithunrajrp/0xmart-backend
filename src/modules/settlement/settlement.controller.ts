import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { SettlementService } from './settlement.service';
import {
  CreateSettlementRequestDto,
  SettlementFilterDto,
  ApproveSettlementDto,
  RejectSettlementDto,
  ConfirmSettlementDto,
  CancelSettlementDto,
  HoldSettlementDto,
  ReleaseHoldDto,
  BulkSettlementActionDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NetworkType } from '@prisma/client';

// ===== MERCHANT ENDPOINTS =====

@ApiTags('Settlement - Merchant')
@Controller('merchant/settlements')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class MerchantSettlementController {
  constructor(private readonly settlementService: SettlementService) {}

  @Post('request')
  @Roles('MERCHANT')
  @ApiOperation({ summary: 'Request a new settlement' })
  @ApiResponse({ status: 201, description: 'Settlement request created' })
  @ApiResponse({ status: 400, description: 'Invalid request or insufficient balance' })
  @ApiResponse({ status: 409, description: 'Pending settlement already exists' })
  async requestSettlement(
    @CurrentUser() user: any,
    @Body() dto: CreateSettlementRequestDto,
  ) {
    const sellerId = user.sellerProfile?.id;
    if (!sellerId) {
      throw new Error('Merchant profile not found');
    }
    return this.settlementService.createSettlementRequest(sellerId, dto);
  }

  @Get()
  @Roles('MERCHANT')
  @ApiOperation({ summary: 'Get merchant settlement history' })
  @ApiResponse({ status: 200, description: 'List of settlements' })
  async getSettlements(
    @CurrentUser() user: any,
    @Query() dto: SettlementFilterDto,
  ) {
    const sellerId = user.sellerProfile?.id;
    if (!sellerId) {
      throw new Error('Merchant profile not found');
    }
    return this.settlementService.getMerchantSettlements(sellerId, dto);
  }

  @Get('analytics')
  @Roles('MERCHANT')
  @ApiOperation({ summary: 'Get merchant settlement analytics' })
  @ApiResponse({ status: 200, description: 'Settlement analytics' })
  async getAnalytics(@CurrentUser() user: any) {
    const sellerId = user.sellerProfile?.id;
    if (!sellerId) {
      throw new Error('Merchant profile not found');
    }
    return this.settlementService.getMerchantSettlementAnalytics(sellerId);
  }

  @Get(':id')
  @Roles('MERCHANT')
  @ApiOperation({ summary: 'Get settlement details' })
  @ApiParam({ name: 'id', description: 'Settlement ID' })
  @ApiResponse({ status: 200, description: 'Settlement details' })
  @ApiResponse({ status: 404, description: 'Settlement not found' })
  async getSettlement(@CurrentUser() user: any, @Param('id') id: string) {
    const sellerId = user.sellerProfile?.id;
    if (!sellerId) {
      throw new Error('Merchant profile not found');
    }
    return this.settlementService.getSettlement(id, sellerId);
  }

  @Post(':id/cancel')
  @Roles('MERCHANT')
  @ApiOperation({ summary: 'Cancel a pending settlement request' })
  @ApiParam({ name: 'id', description: 'Settlement ID' })
  @ApiResponse({ status: 200, description: 'Settlement cancelled' })
  @ApiResponse({ status: 400, description: 'Cannot cancel settlement' })
  async cancelSettlement(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: CancelSettlementDto,
  ) {
    const sellerId = user.sellerProfile?.id;
    if (!sellerId) {
      throw new Error('Merchant profile not found');
    }
    return this.settlementService.cancelSettlement(sellerId, id, dto.reason);
  }
}

// ===== ADMIN ENDPOINTS =====

@ApiTags('Settlement - Admin')
@Controller('admin/settlements')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AdminSettlementController {
  constructor(private readonly settlementService: SettlementService) {}

  @Get()
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get all settlements' })
  @ApiResponse({ status: 200, description: 'List of all settlements' })
  async getAllSettlements(@Query() dto: SettlementFilterDto) {
    return this.settlementService.getAllSettlements(dto);
  }

  @Get('summary')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get settlement summary dashboard data' })
  @ApiResponse({ status: 200, description: 'Settlement summary' })
  async getSummary() {
    return this.settlementService.getSettlementSummary();
  }

  @Get('processing-queue')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get approved settlements ready for processing' })
  @ApiResponse({ status: 200, description: 'Settlements grouped by network' })
  async getProcessingQueue(@Query('network') network?: NetworkType) {
    return this.settlementService.getSettlementsForProcessing(network);
  }

  @Get(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get settlement details' })
  @ApiParam({ name: 'id', description: 'Settlement ID' })
  @ApiResponse({ status: 200, description: 'Settlement details' })
  @ApiResponse({ status: 404, description: 'Settlement not found' })
  async getSettlement(@Param('id') id: string) {
    return this.settlementService.getSettlement(id);
  }

  @Post(':id/approve')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Approve a settlement request' })
  @ApiParam({ name: 'id', description: 'Settlement ID' })
  @ApiResponse({ status: 200, description: 'Settlement approved' })
  @ApiResponse({ status: 400, description: 'Cannot approve settlement' })
  async approveSettlement(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: ApproveSettlementDto,
  ) {
    return this.settlementService.approveSettlement(id, user.id, dto);
  }

  @Post(':id/reject')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Reject a settlement request' })
  @ApiParam({ name: 'id', description: 'Settlement ID' })
  @ApiResponse({ status: 200, description: 'Settlement rejected' })
  @ApiResponse({ status: 400, description: 'Cannot reject settlement' })
  async rejectSettlement(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: RejectSettlementDto,
  ) {
    return this.settlementService.rejectSettlement(id, user.id, dto);
  }

  @Post(':id/hold')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Put settlement on hold' })
  @ApiParam({ name: 'id', description: 'Settlement ID' })
  @ApiResponse({ status: 200, description: 'Settlement put on hold' })
  async holdSettlement(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: HoldSettlementDto,
  ) {
    return this.settlementService.holdSettlement(id, user.id, dto);
  }

  @Post(':id/release-hold')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Release settlement from hold' })
  @ApiParam({ name: 'id', description: 'Settlement ID' })
  @ApiResponse({ status: 200, description: 'Settlement released from hold' })
  async releaseHold(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: ReleaseHoldDto,
  ) {
    return this.settlementService.releaseHold(id, user.id, dto);
  }

  @Post(':id/process')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Mark settlement as processing (funds being sent)' })
  @ApiParam({ name: 'id', description: 'Settlement ID' })
  @ApiResponse({ status: 200, description: 'Settlement marked as processing' })
  async markProcessing(@CurrentUser() user: any, @Param('id') id: string) {
    return this.settlementService.markProcessing(id, user.id);
  }

  @Post(':id/confirm')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Confirm settlement with transaction hash' })
  @ApiParam({ name: 'id', description: 'Settlement ID' })
  @ApiResponse({ status: 200, description: 'Settlement confirmed as completed' })
  @ApiResponse({ status: 400, description: 'Invalid status or txHash' })
  async confirmSettlement(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: ConfirmSettlementDto,
  ) {
    return this.settlementService.confirmSettlement(id, user.id, dto);
  }

  @Post(':id/fail')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Mark settlement as failed' })
  @ApiParam({ name: 'id', description: 'Settlement ID' })
  @ApiResponse({ status: 200, description: 'Settlement marked as failed' })
  async markFailed(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: RejectSettlementDto,
  ) {
    return this.settlementService.markFailed(id, user.id, dto.reason);
  }

  @Post('bulk')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Perform bulk action on settlements' })
  @ApiResponse({ status: 200, description: 'Bulk action results' })
  async bulkAction(
    @CurrentUser() user: any,
    @Body() dto: BulkSettlementActionDto,
  ) {
    return this.settlementService.bulkAction(user.id, dto);
  }
}
