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
  ApiQuery,
} from '@nestjs/swagger';
import { AccountingService } from './accounting.service';
import {
  CreateJournalEntryDto,
  JournalEntryFilterDto,
  CreateLedgerAccountDto,
  UpdateLedgerAccountDto,
  AccountBalanceFilterDto,
  PostJournalEntryDto,
  ReverseJournalEntryDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { StablecoinType } from '@prisma/client';

@ApiTags('Accounting')
@Controller('admin/accounting')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  // ===== CHART OF ACCOUNTS =====

  @Get('accounts')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get chart of accounts (hierarchical)' })
  @ApiResponse({ status: 200, description: 'Chart of accounts' })
  async getChartOfAccounts() {
    return this.accountingService.getChartOfAccounts();
  }

  @Get('accounts/flat')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get all accounts (flat list)' })
  @ApiResponse({ status: 200, description: 'All accounts' })
  async getAllAccounts() {
    return this.accountingService.getAllAccounts();
  }

  @Post('accounts')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Create a new ledger account' })
  @ApiResponse({ status: 201, description: 'Account created' })
  @ApiResponse({ status: 400, description: 'Account code already exists' })
  async createAccount(@Body() dto: CreateLedgerAccountDto) {
    return this.accountingService.createAccount(dto);
  }

  @Put('accounts/:id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Update a ledger account' })
  @ApiParam({ name: 'id', description: 'Account ID' })
  @ApiResponse({ status: 200, description: 'Account updated' })
  async updateAccount(
    @Param('id') id: string,
    @Body() dto: UpdateLedgerAccountDto,
  ) {
    return this.accountingService.updateAccount(id, dto);
  }

  @Get('accounts/:code/balance')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get account balance' })
  @ApiParam({ name: 'code', description: 'Account code' })
  @ApiQuery({ name: 'asOfDate', required: false })
  @ApiResponse({ status: 200, description: 'Account balance' })
  async getAccountBalance(
    @Param('code') code: string,
    @Query('asOfDate') asOfDate?: string,
  ) {
    const date = asOfDate ? new Date(asOfDate) : undefined;
    return this.accountingService.getAccountBalance(code, date);
  }

  // ===== JOURNAL ENTRIES =====

  @Get('journal-entries')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get journal entries' })
  @ApiResponse({ status: 200, description: 'List of journal entries' })
  async getJournalEntries(@Query() dto: JournalEntryFilterDto) {
    return this.accountingService.getJournalEntries(dto);
  }

  @Get('journal-entries/:id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get journal entry by ID' })
  @ApiParam({ name: 'id', description: 'Journal entry ID' })
  @ApiResponse({ status: 200, description: 'Journal entry details' })
  async getJournalEntry(@Param('id') id: string) {
    return this.accountingService.getJournalEntry(id);
  }

  @Post('journal-entries')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Create a manual journal entry' })
  @ApiResponse({ status: 201, description: 'Journal entry created' })
  @ApiResponse({ status: 400, description: 'Entry does not balance' })
  async createJournalEntry(
    @CurrentUser() user: any,
    @Body() dto: CreateJournalEntryDto,
  ) {
    return this.accountingService.createJournalEntry(dto, user.id);
  }

  @Post('journal-entries/:id/post')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Post a draft journal entry' })
  @ApiParam({ name: 'id', description: 'Journal entry ID' })
  @ApiResponse({ status: 200, description: 'Journal entry posted' })
  async postJournalEntry(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: PostJournalEntryDto,
  ) {
    return this.accountingService.postJournalEntry(id, user.id);
  }

  @Post('journal-entries/:id/reverse')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Reverse a posted journal entry' })
  @ApiParam({ name: 'id', description: 'Journal entry ID' })
  @ApiResponse({ status: 200, description: 'Journal entry reversed' })
  async reverseJournalEntry(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: ReverseJournalEntryDto,
  ) {
    return this.accountingService.reverseJournalEntry(id, dto.reason, user.id);
  }

  // ===== REPORTS =====

  @Get('trial-balance')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get trial balance report' })
  @ApiQuery({ name: 'asOfDate', required: false })
  @ApiQuery({ name: 'stablecoinType', required: false, enum: ['USDT', 'USDC'] })
  @ApiResponse({ status: 200, description: 'Trial balance report' })
  async getTrialBalance(
    @Query('asOfDate') asOfDate?: string,
    @Query('stablecoinType') stablecoinType?: StablecoinType,
  ) {
    const date = asOfDate ? new Date(asOfDate) : undefined;
    return this.accountingService.getTrialBalance(date, stablecoinType);
  }
}
