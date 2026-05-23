import {
  Injectable,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreateJournalEntryDto,
  JournalEntryFilterDto,
  CreateLedgerAccountDto,
  UpdateLedgerAccountDto,
  AccountBalanceFilterDto,
} from './dto';
import {
  LedgerAccountType,
  StablecoinType,
  JournalEntryStatus,
  LedgerEntryType,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class AccountingService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Initialize chart of accounts on module startup
   */
  async onModuleInit() {
    await this.initializeChartOfAccounts();
  }

  /**
   * Standard chart of accounts for a crypto commerce platform
   */
  private readonly standardAccounts = [
    // ASSETS (1000-1999)
    { code: '1000', name: 'Assets', type: 'ASSET', parentCode: null },
    { code: '1100', name: 'Cash and Cash Equivalents', type: 'ASSET', parentCode: '1000' },
    { code: '1110', name: 'Crypto Wallets - USDT', type: 'ASSET', parentCode: '1100' },
    { code: '1111', name: 'USDT - Ethereum', type: 'ASSET', parentCode: '1110' },
    { code: '1112', name: 'USDT - Polygon', type: 'ASSET', parentCode: '1110' },
    { code: '1113', name: 'USDT - BSC', type: 'ASSET', parentCode: '1110' },
    { code: '1114', name: 'USDT - Arbitrum', type: 'ASSET', parentCode: '1110' },
    { code: '1115', name: 'USDT - Optimism', type: 'ASSET', parentCode: '1110' },
    { code: '1116', name: 'USDT - Avalanche', type: 'ASSET', parentCode: '1110' },
    { code: '1117', name: 'USDT - Base', type: 'ASSET', parentCode: '1110' },
    { code: '1120', name: 'Crypto Wallets - USDC', type: 'ASSET', parentCode: '1100' },
    { code: '1121', name: 'USDC - Ethereum', type: 'ASSET', parentCode: '1120' },
    { code: '1122', name: 'USDC - Polygon', type: 'ASSET', parentCode: '1120' },
    { code: '1123', name: 'USDC - BSC', type: 'ASSET', parentCode: '1120' },
    { code: '1124', name: 'USDC - Arbitrum', type: 'ASSET', parentCode: '1120' },
    { code: '1125', name: 'USDC - Optimism', type: 'ASSET', parentCode: '1120' },
    { code: '1126', name: 'USDC - Avalanche', type: 'ASSET', parentCode: '1120' },
    { code: '1127', name: 'USDC - Base', type: 'ASSET', parentCode: '1120' },
    { code: '1200', name: 'Accounts Receivable', type: 'ASSET', parentCode: '1000' },
    { code: '1210', name: 'Customer Receivables', type: 'ASSET', parentCode: '1200' },
    { code: '1220', name: 'Pending Deposits', type: 'ASSET', parentCode: '1200' },

    // LIABILITIES (2000-2999)
    { code: '2000', name: 'Liabilities', type: 'LIABILITY', parentCode: null },
    { code: '2100', name: 'Merchant Payables', type: 'LIABILITY', parentCode: '2000' },
    { code: '2110', name: 'Merchant Payables - USDT', type: 'LIABILITY', parentCode: '2100' },
    { code: '2120', name: 'Merchant Payables - USDC', type: 'LIABILITY', parentCode: '2100' },
    { code: '2200', name: 'Customer Deposits', type: 'LIABILITY', parentCode: '2000' },
    { code: '2210', name: 'Customer Wallet Balances - USDT', type: 'LIABILITY', parentCode: '2200' },
    { code: '2220', name: 'Customer Wallet Balances - USDC', type: 'LIABILITY', parentCode: '2200' },
    { code: '2300', name: 'Pending Settlements', type: 'LIABILITY', parentCode: '2000' },
    { code: '2310', name: 'Settlements Processing - USDT', type: 'LIABILITY', parentCode: '2300' },
    { code: '2320', name: 'Settlements Processing - USDC', type: 'LIABILITY', parentCode: '2300' },
    { code: '2400', name: 'Refunds Payable', type: 'LIABILITY', parentCode: '2000' },

    // EQUITY (3000-3999)
    { code: '3000', name: 'Equity', type: 'EQUITY', parentCode: null },
    { code: '3100', name: 'Retained Earnings', type: 'EQUITY', parentCode: '3000' },
    { code: '3200', name: 'Current Period Earnings', type: 'EQUITY', parentCode: '3000' },

    // REVENUE (4000-4999)
    { code: '4000', name: 'Revenue', type: 'REVENUE', parentCode: null },
    { code: '4100', name: 'Order Commission Revenue', type: 'REVENUE', parentCode: '4000' },
    { code: '4110', name: 'Order Commission - USDT', type: 'REVENUE', parentCode: '4100' },
    { code: '4120', name: 'Order Commission - USDC', type: 'REVENUE', parentCode: '4100' },
    { code: '4200', name: 'Settlement Fee Revenue', type: 'REVENUE', parentCode: '4000' },
    { code: '4210', name: 'Settlement Fees - USDT', type: 'REVENUE', parentCode: '4200' },
    { code: '4220', name: 'Settlement Fees - USDC', type: 'REVENUE', parentCode: '4200' },
    { code: '4300', name: 'API Commission Revenue', type: 'REVENUE', parentCode: '4000' },
    { code: '4400', name: 'Network Fee Revenue', type: 'REVENUE', parentCode: '4000' },
    { code: '4500', name: 'Other Revenue', type: 'REVENUE', parentCode: '4000' },

    // EXPENSES (5000-5999)
    { code: '5000', name: 'Expenses', type: 'EXPENSE', parentCode: null },
    { code: '5100', name: 'Network Gas Fees', type: 'EXPENSE', parentCode: '5000' },
    { code: '5110', name: 'Gas Fees - Ethereum', type: 'EXPENSE', parentCode: '5100' },
    { code: '5120', name: 'Gas Fees - Polygon', type: 'EXPENSE', parentCode: '5100' },
    { code: '5130', name: 'Gas Fees - BSC', type: 'EXPENSE', parentCode: '5100' },
    { code: '5140', name: 'Gas Fees - Other', type: 'EXPENSE', parentCode: '5100' },
    { code: '5200', name: 'Payment Provider Fees', type: 'EXPENSE', parentCode: '5000' },
    { code: '5210', name: 'Stripe Fees', type: 'EXPENSE', parentCode: '5200' },
    { code: '5220', name: 'Razorpay Fees', type: 'EXPENSE', parentCode: '5200' },
    { code: '5300', name: 'Refunds and Chargebacks', type: 'EXPENSE', parentCode: '5000' },
    { code: '5400', name: 'Bad Debt', type: 'EXPENSE', parentCode: '5000' },
  ];

  /**
   * Initialize chart of accounts if not exists
   */
  async initializeChartOfAccounts() {
    const existingCount = await this.prisma.ledgerAccount.count();

    if (existingCount > 0) {
      return; // Already initialized
    }

    // Create accounts in order (parents first)
    for (const account of this.standardAccounts) {
      const parentId = account.parentCode
        ? (await this.prisma.ledgerAccount.findUnique({
            where: { code: account.parentCode },
          }))?.id
        : null;

      await this.prisma.ledgerAccount.create({
        data: {
          code: account.code,
          name: account.name,
          type: account.type as LedgerAccountType,
          parentId,
          isSystemAccount: true,
        },
      });
    }

    console.log('Chart of accounts initialized with', this.standardAccounts.length, 'accounts');
  }

  /**
   * Generate unique journal entry number
   */
  private generateEntryNumber(): string {
    const date = new Date();
    const prefix = `JE-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}-${random}`;
  }

  // ===== CHART OF ACCOUNTS MANAGEMENT =====

  /**
   * Get all ledger accounts (chart of accounts)
   */
  async getChartOfAccounts() {
    const accounts = await this.prisma.ledgerAccount.findMany({
      orderBy: { code: 'asc' },
      include: {
        parent: { select: { code: true, name: true } },
      },
    });

    // Build hierarchical structure
    const accountMap = new Map();
    const rootAccounts: any[] = [];

    accounts.forEach((acc) => {
      accountMap.set(acc.id, { ...acc, children: [] });
    });

    accounts.forEach((acc) => {
      const account = accountMap.get(acc.id);
      if (acc.parentId) {
        const parent = accountMap.get(acc.parentId);
        if (parent) {
          parent.children.push(account);
        }
      } else {
        rootAccounts.push(account);
      }
    });

    return rootAccounts;
  }

  /**
   * Get flat list of accounts
   */
  async getAllAccounts() {
    return this.prisma.ledgerAccount.findMany({
      orderBy: { code: 'asc' },
    });
  }

  /**
   * Create a new ledger account
   */
  async createAccount(dto: CreateLedgerAccountDto) {
    const existing = await this.prisma.ledgerAccount.findUnique({
      where: { code: dto.code },
    });

    if (existing) {
      throw new BadRequestException(`Account with code ${dto.code} already exists`);
    }

    let parentId: string | undefined = undefined;
    if (dto.parentCode) {
      const parent = await this.prisma.ledgerAccount.findUnique({
        where: { code: dto.parentCode },
      });
      if (!parent) {
        throw new NotFoundException(`Parent account ${dto.parentCode} not found`);
      }
      parentId = parent.id;
    }

    return this.prisma.ledgerAccount.create({
      data: {
        code: dto.code,
        name: dto.name,
        type: dto.type as LedgerAccountType,
        description: dto.description,
        parentId,
      },
    });
  }

  /**
   * Update a ledger account
   */
  async updateAccount(accountId: string, dto: UpdateLedgerAccountDto) {
    const account = await this.prisma.ledgerAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    if (account.isSystemAccount && dto.isActive === false) {
      throw new BadRequestException('Cannot deactivate system accounts');
    }

    return this.prisma.ledgerAccount.update({
      where: { id: accountId },
      data: dto,
    });
  }

  /**
   * Get account by code
   */
  async getAccountByCode(code: string) {
    const account = await this.prisma.ledgerAccount.findUnique({
      where: { code },
    });

    if (!account) {
      throw new NotFoundException(`Account ${code} not found`);
    }

    return account;
  }

  // ===== JOURNAL ENTRY MANAGEMENT =====

  /**
   * Create a journal entry
   */
  async createJournalEntry(dto: CreateJournalEntryDto, createdBy?: string) {
    // Validate that debits = credits
    const totalDebits = dto.lines.reduce((sum, line) => sum + line.debitAmount, 0);
    const totalCredits = dto.lines.reduce((sum, line) => sum + line.creditAmount, 0);

    if (Math.abs(totalDebits - totalCredits) > 0.00000001) {
      throw new BadRequestException(
        `Journal entry must balance. Debits: ${totalDebits}, Credits: ${totalCredits}`,
      );
    }

    // Validate accounts exist
    for (const line of dto.lines) {
      await this.getAccountByCode(line.accountCode);
    }

    // Create the journal entry with lines
    const entry = await this.prisma.$transaction(async (tx) => {
      // Create journal entry
      const journalEntry = await tx.journalEntry.create({
        data: {
          entryNumber: this.generateEntryNumber(),
          referenceType: dto.referenceType,
          referenceId: dto.referenceId,
          stablecoinType: dto.stablecoinType,
          description: dto.description,
          totalAmount: new Decimal(totalDebits),
          status: dto.autoPost ? 'POSTED' : 'DRAFT',
          postedAt: dto.autoPost ? new Date() : null,
          postedBy: dto.autoPost ? createdBy : null,
          createdBy,
        },
      });

      // Create journal entry lines
      for (const line of dto.lines) {
        const account = await tx.ledgerAccount.findUnique({
          where: { code: line.accountCode },
        });

        await tx.journalEntryLine.create({
          data: {
            journalEntryId: journalEntry.id,
            accountId: account!.id,
            debitAmount: new Decimal(line.debitAmount),
            creditAmount: new Decimal(line.creditAmount),
            description: line.description,
          },
        });
      }

      // If auto-post, create ledger entries
      if (dto.autoPost) {
        for (const line of dto.lines) {
          const account = await tx.ledgerAccount.findUnique({
            where: { code: line.accountCode },
          });

          // Determine net amount and type
          const netAmount = line.debitAmount - line.creditAmount;

          await tx.ledgerEntry.create({
            data: {
              entryType: dto.referenceType as LedgerEntryType || 'ADJUSTMENT',
              referenceId: dto.referenceId || journalEntry.id,
              accountId: account!.id,
              stablecoinType: dto.stablecoinType,
              debit: new Decimal(line.debitAmount),
              credit: new Decimal(line.creditAmount),
              description: line.description || dto.description,
            },
          });
        }
      }

      return journalEntry;
    });

    return this.getJournalEntry(entry.id);
  }

  /**
   * Get journal entry by ID
   */
  async getJournalEntry(entryId: string) {
    const entry = await this.prisma.journalEntry.findUnique({
      where: { id: entryId },
      include: {
        lines: {
          include: {
            account: { select: { code: true, name: true, type: true } },
          },
        },
      },
    });

    if (!entry) {
      throw new NotFoundException('Journal entry not found');
    }

    return {
      ...entry,
      totalAmount: entry.totalAmount.toString(),
      lines: entry.lines.map((l) => ({
        ...l,
        debitAmount: l.debitAmount.toString(),
        creditAmount: l.creditAmount.toString(),
      })),
    };
  }

  /**
   * Get journal entries with filters
   */
  async getJournalEntries(dto: JournalEntryFilterDto) {
    const page = dto.page || 1;
    const limit = dto.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (dto.stablecoinType) {
      where.stablecoinType = dto.stablecoinType;
    }
    if (dto.referenceType) {
      where.referenceType = dto.referenceType;
    }
    if (dto.status) {
      where.status = dto.status;
    }
    if (dto.startDate) {
      where.createdAt = { ...where.createdAt, gte: new Date(dto.startDate) };
    }
    if (dto.endDate) {
      where.createdAt = { ...where.createdAt, lte: new Date(dto.endDate) };
    }

    const [entries, total] = await Promise.all([
      this.prisma.journalEntry.findMany({
        where,
        include: {
          lines: {
            include: {
              account: { select: { code: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.journalEntry.count({ where }),
    ]);

    return {
      entries: entries.map((e) => ({
        ...e,
        totalAmount: e.totalAmount.toString(),
        lines: e.lines.map((l) => ({
          ...l,
          debitAmount: l.debitAmount.toString(),
          creditAmount: l.creditAmount.toString(),
        })),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Post a draft journal entry
   */
  async postJournalEntry(entryId: string, postedBy: string) {
    const entry = await this.prisma.journalEntry.findUnique({
      where: { id: entryId },
      include: { lines: { include: { account: true } } },
    });

    if (!entry) {
      throw new NotFoundException('Journal entry not found');
    }

    if (entry.status !== 'DRAFT') {
      throw new BadRequestException('Only draft entries can be posted');
    }

    return this.prisma.$transaction(async (tx) => {
      // Update entry status
      const updated = await tx.journalEntry.update({
        where: { id: entryId },
        data: {
          status: 'POSTED',
          postedAt: new Date(),
          postedBy,
        },
      });

      // Create ledger entries
      for (const line of entry.lines) {
        await tx.ledgerEntry.create({
          data: {
            entryType: (entry.referenceType as LedgerEntryType) || 'ADJUSTMENT',
            referenceId: entry.referenceId || entry.id,
            accountId: line.accountId,
            stablecoinType: entry.stablecoinType,
            debit: line.debitAmount,
            credit: line.creditAmount,
            description: line.description || entry.description,
          },
        });
      }

      return this.getJournalEntry(entryId);
    });
  }

  /**
   * Reverse a posted journal entry
   */
  async reverseJournalEntry(entryId: string, reason: string, reversedBy: string) {
    const entry = await this.prisma.journalEntry.findUnique({
      where: { id: entryId },
      include: { lines: { include: { account: true } } },
    });

    if (!entry) {
      throw new NotFoundException('Journal entry not found');
    }

    if (entry.status !== 'POSTED') {
      throw new BadRequestException('Only posted entries can be reversed');
    }

    // Create reversing entry (swap debits and credits)
    const reversingLines = entry.lines.map((line) => ({
      accountCode: line.account.code,
      debitAmount: line.creditAmount.toNumber(),
      creditAmount: line.debitAmount.toNumber(),
      description: `Reversal: ${line.description || ''}`,
    }));

    return this.prisma.$transaction(async (tx) => {
      // Mark original as reversed
      await tx.journalEntry.update({
        where: { id: entryId },
        data: { status: 'REVERSED' },
      });

      // Create reversing entry
      const reversingEntry = await this.createJournalEntry({
        referenceType: 'REVERSAL',
        referenceId: entryId,
        stablecoinType: entry.stablecoinType,
        description: `Reversal of ${entry.entryNumber}: ${reason}`,
        lines: reversingLines,
        autoPost: true,
      }, reversedBy);

      return reversingEntry;
    });
  }

  // ===== ACCOUNT BALANCES =====

  /**
   * Get account balance as of a date
   */
  async getAccountBalance(accountCode: string, asOfDate?: Date) {
    const account = await this.getAccountByCode(accountCode);
    const date = asOfDate || new Date();

    const entries = await this.prisma.ledgerEntry.aggregate({
      where: {
        accountId: account.id,
        createdAt: { lte: date },
      },
      _sum: {
        debit: true,
        credit: true,
      },
    });

    const totalDebits = entries._sum.debit?.toNumber() || 0;
    const totalCredits = entries._sum.credit?.toNumber() || 0;

    // Balance calculation depends on account type
    // Assets & Expenses: Debit balance (Debits - Credits)
    // Liabilities, Equity, Revenue: Credit balance (Credits - Debits)
    let balance: number;
    if (['ASSET', 'EXPENSE', 'CONTRA_LIABILITY', 'CONTRA_REVENUE'].includes(account.type)) {
      balance = totalDebits - totalCredits;
    } else {
      balance = totalCredits - totalDebits;
    }

    return {
      account: {
        code: account.code,
        name: account.name,
        type: account.type,
      },
      asOfDate: date,
      totalDebits: totalDebits.toString(),
      totalCredits: totalCredits.toString(),
      balance: balance.toString(),
      balanceType: balance >= 0 ? 'DEBIT' : 'CREDIT',
    };
  }

  /**
   * Get trial balance (all account balances)
   */
  async getTrialBalance(asOfDate?: Date, stablecoinType?: StablecoinType) {
    const accounts = await this.prisma.ledgerAccount.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    });

    const date = asOfDate || new Date();
    const balances: any[] = [];
    let totalDebits = 0;
    let totalCredits = 0;

    for (const account of accounts) {
      const where: any = {
        accountId: account.id,
        createdAt: { lte: date },
      };

      if (stablecoinType) {
        where.stablecoinType = stablecoinType;
      }

      const entries = await this.prisma.ledgerEntry.aggregate({
        where,
        _sum: {
          debit: true,
          credit: true,
        },
      });

      const debits = entries._sum.debit?.toNumber() || 0;
      const credits = entries._sum.credit?.toNumber() || 0;

      // Skip zero balance accounts for cleaner report
      if (debits === 0 && credits === 0) {
        continue;
      }

      let balance: number;
      if (['ASSET', 'EXPENSE', 'CONTRA_LIABILITY', 'CONTRA_REVENUE'].includes(account.type)) {
        balance = debits - credits;
      } else {
        balance = credits - debits;
      }

      // For trial balance, show debit or credit column
      const debitBalance = balance > 0 ? balance : 0;
      const creditBalance = balance < 0 ? Math.abs(balance) : 0;

      totalDebits += debitBalance;
      totalCredits += creditBalance;

      balances.push({
        code: account.code,
        name: account.name,
        type: account.type,
        debitBalance: debitBalance.toString(),
        creditBalance: creditBalance.toString(),
      });
    }

    return {
      asOfDate: date,
      stablecoinType: stablecoinType || 'ALL',
      accounts: balances,
      totals: {
        debits: totalDebits.toString(),
        credits: totalCredits.toString(),
        isBalanced: Math.abs(totalDebits - totalCredits) < 0.00000001,
      },
    };
  }

  // ===== AUTOMATED JOURNAL ENTRIES FOR BUSINESS EVENTS =====

  /**
   * Record order received (customer payment)
   * Debit: Cash/Crypto Asset
   * Credit: Customer Deposit Liability + Merchant Payable + Commission Revenue
   */
  async recordOrderReceived(params: {
    orderId: string;
    orderNumber: string;
    totalAmount: number;
    merchantAmount: number;
    commissionAmount: number;
    stablecoinType: StablecoinType;
    network: string;
  }) {
    const {
      orderId,
      orderNumber,
      totalAmount,
      merchantAmount,
      commissionAmount,
      stablecoinType,
    } = params;

    // Determine account codes based on stablecoin
    const cashAccount = stablecoinType === 'USDT' ? '1112' : '1122'; // Polygon by default
    const merchantPayable = stablecoinType === 'USDT' ? '2110' : '2120';
    const commissionRevenue = stablecoinType === 'USDT' ? '4110' : '4120';

    const lines = [
      {
        accountCode: cashAccount,
        debitAmount: totalAmount,
        creditAmount: 0,
        description: `Received payment for order ${orderNumber}`,
      },
      {
        accountCode: merchantPayable,
        debitAmount: 0,
        creditAmount: merchantAmount,
        description: `Merchant payable for order ${orderNumber}`,
      },
      {
        accountCode: commissionRevenue,
        debitAmount: 0,
        creditAmount: commissionAmount,
        description: `Commission earned on order ${orderNumber}`,
      },
    ];

    return this.createJournalEntry({
      referenceType: 'ORDER',
      referenceId: orderId,
      stablecoinType,
      description: `Order received: ${orderNumber}`,
      lines,
      autoPost: true,
    });
  }

  /**
   * Record settlement to merchant
   * Debit: Merchant Payable (reduce liability)
   * Credit: Cash/Crypto Asset (reduce asset)
   * Debit: Settlement Fee Expense (if any additional fees)
   * Credit: Settlement Fee Revenue
   */
  async recordSettlement(params: {
    settlementId: string;
    settlementNumber: string;
    grossAmount: number;
    platformFee: number;
    netAmount: number;
    stablecoinType: StablecoinType;
    network: string;
  }) {
    const {
      settlementId,
      settlementNumber,
      grossAmount,
      platformFee,
      netAmount,
      stablecoinType,
    } = params;

    const cashAccount = stablecoinType === 'USDT' ? '1112' : '1122';
    const merchantPayable = stablecoinType === 'USDT' ? '2110' : '2120';
    const settlementFeeRevenue = stablecoinType === 'USDT' ? '4210' : '4220';

    const lines = [
      {
        accountCode: merchantPayable,
        debitAmount: grossAmount,
        creditAmount: 0,
        description: `Settlement ${settlementNumber} - Clear merchant payable`,
      },
      {
        accountCode: cashAccount,
        debitAmount: 0,
        creditAmount: netAmount,
        description: `Settlement ${settlementNumber} - Payment to merchant`,
      },
      {
        accountCode: settlementFeeRevenue,
        debitAmount: 0,
        creditAmount: platformFee,
        description: `Settlement ${settlementNumber} - Platform fee`,
      },
    ];

    return this.createJournalEntry({
      referenceType: 'SETTLEMENT',
      referenceId: settlementId,
      stablecoinType,
      description: `Settlement: ${settlementNumber}`,
      lines,
      autoPost: true,
    });
  }

  /**
   * Record refund
   * Debit: Customer Refunds Expense
   * Credit: Cash/Crypto Asset
   */
  async recordRefund(params: {
    refundId: string;
    orderId: string;
    amount: number;
    stablecoinType: StablecoinType;
  }) {
    const { refundId, orderId, amount, stablecoinType } = params;

    const cashAccount = stablecoinType === 'USDT' ? '1112' : '1122';
    const refundExpense = '5300';

    const lines = [
      {
        accountCode: refundExpense,
        debitAmount: amount,
        creditAmount: 0,
        description: `Refund for order ${orderId}`,
      },
      {
        accountCode: cashAccount,
        debitAmount: 0,
        creditAmount: amount,
        description: `Cash out for refund ${refundId}`,
      },
    ];

    return this.createJournalEntry({
      referenceType: 'REFUND',
      referenceId: refundId,
      stablecoinType,
      description: `Refund processed: ${refundId}`,
      lines,
      autoPost: true,
    });
  }

  /**
   * Record network gas fee expense
   */
  async recordGasFee(params: {
    txHash: string;
    amount: number;
    network: string;
    stablecoinType: StablecoinType;
  }) {
    const { txHash, amount, network, stablecoinType } = params;

    const cashAccount = stablecoinType === 'USDT' ? '1112' : '1122';
    const gasFeeAccount = '5140'; // Gas Fees - Other

    const lines = [
      {
        accountCode: gasFeeAccount,
        debitAmount: amount,
        creditAmount: 0,
        description: `Gas fee for tx ${txHash} on ${network}`,
      },
      {
        accountCode: cashAccount,
        debitAmount: 0,
        creditAmount: amount,
        description: `Gas paid for tx ${txHash}`,
      },
    ];

    return this.createJournalEntry({
      referenceType: 'GAS_FEE',
      referenceId: txHash,
      stablecoinType,
      description: `Network gas fee: ${network}`,
      lines,
      autoPost: true,
    });
  }
}
