import {
  Controller,
  Get,
  Post,
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
  ApiQuery,
} from '@nestjs/swagger';
import { FinancialReportsService } from './financial-reports.service';
import {
  DateRangeFilterDto,
  BalanceSheetFilterDto,
  RevenueAnalyticsFilterDto,
  ReconciliationFilterDto,
  CreateReconciliationDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { StablecoinType } from '@prisma/client';

@ApiTags('Financial Reports')
@Controller('admin/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class FinancialReportsController {
  constructor(private readonly reportsService: FinancialReportsService) {}

  @Get('dashboard')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get admin dashboard summary' })
  @ApiResponse({ status: 200, description: 'Dashboard summary data' })
  async getDashboardSummary() {
    return this.reportsService.getAdminDashboardSummary();
  }

  @Get('balance-sheet')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Generate balance sheet report' })
  @ApiResponse({ status: 200, description: 'Balance sheet report' })
  async getBalanceSheet(@Query() dto: BalanceSheetFilterDto) {
    return this.reportsService.generateBalanceSheet(dto);
  }

  @Get('income-statement')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Generate income statement (P&L) report' })
  @ApiResponse({ status: 200, description: 'Income statement report' })
  async getIncomeStatement(@Query() dto: DateRangeFilterDto) {
    return this.reportsService.generateIncomeStatement(dto);
  }

  @Get('revenue-analytics')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get revenue analytics with time series' })
  @ApiResponse({ status: 200, description: 'Revenue analytics data' })
  async getRevenueAnalytics(@Query() dto: RevenueAnalyticsFilterDto) {
    return this.reportsService.getRevenueAnalytics(dto);
  }

  @Get('settlement-summary')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get settlement summary report' })
  @ApiResponse({ status: 200, description: 'Settlement summary report' })
  async getSettlementSummary(@Query() dto: DateRangeFilterDto) {
    return this.reportsService.getSettlementSummary(dto);
  }

  @Get('merchant-payables')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get merchant payables (liabilities) summary' })
  @ApiQuery({ name: 'stablecoinType', required: false, enum: ['USDT', 'USDC'] })
  @ApiResponse({ status: 200, description: 'Merchant payables summary' })
  async getMerchantPayables(
    @Query('stablecoinType') stablecoinType?: StablecoinType,
  ) {
    return this.reportsService.getMerchantPayablesSummary(stablecoinType);
  }

  // ===== RECONCILIATION =====

  @Get('reconciliations')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get reconciliation records' })
  @ApiResponse({ status: 200, description: 'List of reconciliation records' })
  async getReconciliations(@Query() dto: ReconciliationFilterDto) {
    return this.reportsService.getReconciliations(dto);
  }

  @Post('reconciliations')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Create a new reconciliation record' })
  @ApiResponse({ status: 201, description: 'Reconciliation record created' })
  async createReconciliation(
    @CurrentUser() user: any,
    @Body() dto: CreateReconciliationDto,
  ) {
    return this.reportsService.createReconciliation(dto, user.id);
  }

  @Post('reconciliations/:id/resolve')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Resolve a discrepancy' })
  @ApiParam({ name: 'id', description: 'Reconciliation record ID' })
  @ApiResponse({ status: 200, description: 'Discrepancy resolved' })
  async resolveDiscrepancy(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body('resolution') resolution: string,
  ) {
    return this.reportsService.resolveDiscrepancy(id, resolution, user.id);
  }
}
