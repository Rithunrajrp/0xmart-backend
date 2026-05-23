import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  DateRangeFilterDto,
  BalanceSheetFilterDto,
  RevenueAnalyticsFilterDto,
  ReconciliationFilterDto,
  CreateReconciliationDto,
} from './dto';
import { StablecoinType } from '@prisma/client';

// Reconciliation status type
type ReconciliationStatus = 'MATCHED' | 'DISCREPANCY' | 'PENDING' | 'RESOLVED';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class FinancialReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate Balance Sheet Report
   * Assets = Liabilities + Equity
   */
  async generateBalanceSheet(dto: BalanceSheetFilterDto) {
    const asOfDate = new Date(dto.asOfDate);
    const stablecoinFilter = dto.stablecoinType
      ? { stablecoinType: dto.stablecoinType }
      : {};

    // Get all accounts with their balances
    const accounts = await this.prisma.ledgerAccount.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    });

    const balances: Record<string, any> = {};

    for (const account of accounts) {
      const entries = await this.prisma.ledgerEntry.aggregate({
        where: {
          accountId: account.id,
          createdAt: { lte: asOfDate },
          ...stablecoinFilter,
        },
        _sum: {
          debit: true,
          credit: true,
        },
      });

      const debits = entries._sum.debit?.toNumber() || 0;
      const credits = entries._sum.credit?.toNumber() || 0;

      // Calculate balance based on account type
      let balance: number;
      if (['ASSET', 'EXPENSE', 'CONTRA_LIABILITY', 'CONTRA_REVENUE'].includes(account.type)) {
        balance = debits - credits;
      } else {
        balance = credits - debits;
      }

      if (balance !== 0) {
        balances[account.code] = {
          code: account.code,
          name: account.name,
          type: account.type,
          balance: balance.toFixed(8),
        };
      }
    }

    // Organize by category
    const assets: any[] = [];
    const liabilities: any[] = [];
    const equity: any[] = [];

    Object.values(balances).forEach((acc: any) => {
      if (acc.type === 'ASSET' || acc.type === 'CONTRA_ASSET') {
        assets.push(acc);
      } else if (acc.type === 'LIABILITY' || acc.type === 'CONTRA_LIABILITY') {
        liabilities.push(acc);
      } else if (acc.type === 'EQUITY') {
        equity.push(acc);
      }
    });

    const totalAssets = assets.reduce((sum, a) => sum + parseFloat(a.balance), 0);
    const totalLiabilities = liabilities.reduce((sum, a) => sum + parseFloat(a.balance), 0);
    const totalEquity = equity.reduce((sum, a) => sum + parseFloat(a.balance), 0);

    // Add net income to equity
    const netIncome = await this.calculateNetIncome(
      new Date(asOfDate.getFullYear(), 0, 1), // Start of year
      asOfDate,
      dto.stablecoinType,
    );

    return {
      reportType: 'BALANCE_SHEET',
      asOfDate: dto.asOfDate,
      stablecoinType: dto.stablecoinType || 'ALL',
      assets: {
        items: assets,
        total: totalAssets.toFixed(8),
      },
      liabilities: {
        items: liabilities,
        total: totalLiabilities.toFixed(8),
      },
      equity: {
        items: [
          ...equity,
          {
            code: 'NET_INCOME',
            name: 'Net Income (Current Period)',
            type: 'EQUITY',
            balance: netIncome.toFixed(8),
          },
        ],
        total: (totalEquity + netIncome).toFixed(8),
      },
      totals: {
        totalAssets: totalAssets.toFixed(8),
        totalLiabilitiesAndEquity: (totalLiabilities + totalEquity + netIncome).toFixed(8),
        isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity + netIncome)) < 0.00000001,
      },
    };
  }

  /**
   * Generate Income Statement (Profit & Loss)
   */
  async generateIncomeStatement(dto: DateRangeFilterDto) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    const stablecoinFilter = dto.stablecoinType
      ? { stablecoinType: dto.stablecoinType }
      : {};

    // Get revenue accounts (4000 series)
    const revenueAccounts = await this.prisma.ledgerAccount.findMany({
      where: {
        code: { startsWith: '4' },
        isActive: true,
      },
      orderBy: { code: 'asc' },
    });

    // Get expense accounts (5000 series)
    const expenseAccounts = await this.prisma.ledgerAccount.findMany({
      where: {
        code: { startsWith: '5' },
        isActive: true,
      },
      orderBy: { code: 'asc' },
    });

    const revenues: any[] = [];
    let totalRevenue = 0;

    for (const account of revenueAccounts) {
      const entries = await this.prisma.ledgerEntry.aggregate({
        where: {
          accountId: account.id,
          createdAt: { gte: startDate, lte: endDate },
          ...stablecoinFilter,
        },
        _sum: {
          debit: true,
          credit: true,
        },
      });

      const credits = entries._sum.credit?.toNumber() || 0;
      const debits = entries._sum.debit?.toNumber() || 0;
      const balance = credits - debits;

      if (balance !== 0) {
        revenues.push({
          code: account.code,
          name: account.name,
          amount: balance.toFixed(8),
        });
        totalRevenue += balance;
      }
    }

    const expenses: any[] = [];
    let totalExpenses = 0;

    for (const account of expenseAccounts) {
      const entries = await this.prisma.ledgerEntry.aggregate({
        where: {
          accountId: account.id,
          createdAt: { gte: startDate, lte: endDate },
          ...stablecoinFilter,
        },
        _sum: {
          debit: true,
          credit: true,
        },
      });

      const debits = entries._sum.debit?.toNumber() || 0;
      const credits = entries._sum.credit?.toNumber() || 0;
      const balance = debits - credits;

      if (balance !== 0) {
        expenses.push({
          code: account.code,
          name: account.name,
          amount: balance.toFixed(8),
        });
        totalExpenses += balance;
      }
    }

    const netIncome = totalRevenue - totalExpenses;

    return {
      reportType: 'INCOME_STATEMENT',
      periodStart: dto.startDate,
      periodEnd: dto.endDate,
      stablecoinType: dto.stablecoinType || 'ALL',
      revenue: {
        items: revenues,
        total: totalRevenue.toFixed(8),
      },
      expenses: {
        items: expenses,
        total: totalExpenses.toFixed(8),
      },
      netIncome: netIncome.toFixed(8),
      profitMargin: totalRevenue > 0 ? ((netIncome / totalRevenue) * 100).toFixed(2) + '%' : '0%',
    };
  }

  /**
   * Calculate net income for a period
   */
  private async calculateNetIncome(
    startDate: Date,
    endDate: Date,
    stablecoinType?: StablecoinType,
  ): Promise<number> {
    const stablecoinFilter = stablecoinType ? { stablecoinType } : {};

    // Revenue (credits - debits for revenue accounts)
    const revenueAccounts = await this.prisma.ledgerAccount.findMany({
      where: { code: { startsWith: '4' }, isActive: true },
    });

    let totalRevenue = 0;
    for (const account of revenueAccounts) {
      const entries = await this.prisma.ledgerEntry.aggregate({
        where: {
          accountId: account.id,
          createdAt: { gte: startDate, lte: endDate },
          ...stablecoinFilter,
        },
        _sum: { debit: true, credit: true },
      });
      totalRevenue += (entries._sum.credit?.toNumber() || 0) -
                      (entries._sum.debit?.toNumber() || 0);
    }

    // Expenses (debits - credits for expense accounts)
    const expenseAccounts = await this.prisma.ledgerAccount.findMany({
      where: { code: { startsWith: '5' }, isActive: true },
    });

    let totalExpenses = 0;
    for (const account of expenseAccounts) {
      const entries = await this.prisma.ledgerEntry.aggregate({
        where: {
          accountId: account.id,
          createdAt: { gte: startDate, lte: endDate },
          ...stablecoinFilter,
        },
        _sum: { debit: true, credit: true },
      });
      totalExpenses += (entries._sum.debit?.toNumber() || 0) -
                       (entries._sum.credit?.toNumber() || 0);
    }

    return totalRevenue - totalExpenses;
  }

  /**
   * Revenue Analytics with time series data
   */
  async getRevenueAnalytics(dto: RevenueAnalyticsFilterDto) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    // Get revenue from PlatformRevenue table
    const revenues = await this.prisma.platformRevenue.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        ...(dto.stablecoinType && { stablecoinType: dto.stablecoinType }),
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by revenue type
    const byType: Record<string, number> = {};
    revenues.forEach((r) => {
      if (!byType[r.revenueType]) {
        byType[r.revenueType] = 0;
      }
      byType[r.revenueType] += r.revenueAmount.toNumber();
    });

    // Group by time period
    const timeSeries: Record<string, number> = {};
    revenues.forEach((r) => {
      let key: string;
      const date = new Date(r.createdAt);

      if (dto.groupBy === 'MONTH') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      } else if (dto.groupBy === 'WEEK') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
      } else {
        key = date.toISOString().split('T')[0];
      }

      if (!timeSeries[key]) {
        timeSeries[key] = 0;
      }
      timeSeries[key] += r.revenueAmount.toNumber();
    });

    const totalRevenue = revenues.reduce((sum, r) => sum + r.revenueAmount.toNumber(), 0);

    // Calculate growth
    const midPoint = new Date((startDate.getTime() + endDate.getTime()) / 2);
    const firstHalf = revenues
      .filter((r) => r.createdAt < midPoint)
      .reduce((sum, r) => sum + r.revenueAmount.toNumber(), 0);
    const secondHalf = revenues
      .filter((r) => r.createdAt >= midPoint)
      .reduce((sum, r) => sum + r.revenueAmount.toNumber(), 0);

    const growth = firstHalf > 0 ? ((secondHalf - firstHalf) / firstHalf) * 100 : 0;

    return {
      periodStart: dto.startDate,
      periodEnd: dto.endDate,
      stablecoinType: dto.stablecoinType || 'ALL',
      totalRevenue: totalRevenue.toFixed(8),
      byRevenueType: Object.entries(byType).map(([type, amount]) => ({
        type,
        amount: amount.toFixed(8),
        percentage: ((amount / totalRevenue) * 100).toFixed(2) + '%',
      })),
      timeSeries: Object.entries(timeSeries).map(([period, amount]) => ({
        period,
        amount: amount.toFixed(8),
      })),
      growth: {
        firstHalf: firstHalf.toFixed(8),
        secondHalf: secondHalf.toFixed(8),
        growthPercent: growth.toFixed(2) + '%',
      },
    };
  }

  /**
   * Get settlement summary report
   */
  async getSettlementSummary(dto: DateRangeFilterDto) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    const [completed, pending, byNetwork, byMerchant] = await Promise.all([
      // Completed settlements
      this.prisma.settlement.aggregate({
        where: {
          status: 'COMPLETED',
          completedAt: { gte: startDate, lte: endDate },
          ...(dto.stablecoinType && { stablecoinType: dto.stablecoinType }),
        },
        _sum: { netAmount: true, platformFee: true, grossAmount: true },
        _count: true,
      }),
      // Pending settlements
      this.prisma.settlement.aggregate({
        where: {
          status: { in: ['PENDING', 'APPROVED', 'PROCESSING'] },
          ...(dto.stablecoinType && { stablecoinType: dto.stablecoinType }),
        },
        _sum: { netAmount: true },
        _count: true,
      }),
      // By network
      this.prisma.settlement.groupBy({
        by: ['network'],
        where: {
          status: 'COMPLETED',
          completedAt: { gte: startDate, lte: endDate },
          ...(dto.stablecoinType && { stablecoinType: dto.stablecoinType }),
        },
        _sum: { netAmount: true },
        _count: true,
      }),
      // Top merchants by settlement volume
      this.prisma.settlement.groupBy({
        by: ['sellerId'],
        where: {
          status: 'COMPLETED',
          completedAt: { gte: startDate, lte: endDate },
          ...(dto.stablecoinType && { stablecoinType: dto.stablecoinType }),
        },
        _sum: { netAmount: true },
        _count: true,
        orderBy: { _sum: { netAmount: 'desc' } },
        take: 10,
      }),
    ]);

    // Get merchant names
    const merchantIds = byMerchant.map((m) => m.sellerId);
    const merchants = await this.prisma.seller.findMany({
      where: { id: { in: merchantIds } },
      select: { id: true, companyName: true },
    });

    const merchantMap = new Map(merchants.map((m) => [m.id, m.companyName]));

    return {
      periodStart: dto.startDate,
      periodEnd: dto.endDate,
      stablecoinType: dto.stablecoinType || 'ALL',
      completed: {
        count: completed._count,
        grossAmount: completed._sum.grossAmount?.toString() || '0',
        netAmount: completed._sum.netAmount?.toString() || '0',
        platformFees: completed._sum.platformFee?.toString() || '0',
      },
      pending: {
        count: pending._count,
        amount: pending._sum.netAmount?.toString() || '0',
      },
      byNetwork: byNetwork.map((n) => ({
        network: n.network,
        count: n._count,
        amount: n._sum.netAmount?.toString() || '0',
      })),
      topMerchants: byMerchant.map((m) => ({
        merchantId: m.sellerId,
        merchantName: merchantMap.get(m.sellerId) || 'Unknown',
        count: m._count,
        amount: m._sum.netAmount?.toString() || '0',
      })),
    };
  }

  /**
   * Get merchant payables summary (liabilities)
   */
  async getMerchantPayablesSummary(stablecoinType?: StablecoinType) {
    const where = stablecoinType ? { stablecoinType } : {};

    const balances = await this.prisma.merchantBalance.findMany({
      where,
      include: {
        seller: {
          select: {
            id: true,
            companyName: true,
            user: { select: { email: true } },
          },
        },
      },
      orderBy: { availableBalance: 'desc' },
    });

    const totalPending = balances.reduce(
      (sum, b) => sum + b.pendingBalance.toNumber(),
      0,
    );
    const totalAvailable = balances.reduce(
      (sum, b) => sum + b.availableBalance.toNumber(),
      0,
    );
    const totalOwed = totalPending + totalAvailable;

    return {
      stablecoinType: stablecoinType || 'ALL',
      summary: {
        totalPendingBalance: totalPending.toFixed(8),
        totalAvailableBalance: totalAvailable.toFixed(8),
        totalOwedToMerchants: totalOwed.toFixed(8),
        merchantCount: balances.length,
      },
      merchants: balances.map((b) => ({
        merchantId: b.sellerId,
        companyName: b.seller.companyName,
        email: b.seller.user?.email || '',
        stablecoinType: b.stablecoinType,
        pendingBalance: b.pendingBalance.toString(),
        availableBalance: b.availableBalance.toString(),
        totalBalance: (b.pendingBalance.toNumber() + b.availableBalance.toNumber()).toFixed(8),
        totalEarned: b.totalEarned.toString(),
        totalSettled: b.totalSettled.toString(),
      })),
    };
  }

  /**
   * Create reconciliation record
   */
  async createReconciliation(dto: CreateReconciliationDto, performedBy: string) {
    const discrepancy = dto.actualBalance - dto.systemBalance;
    const isReconciled = Math.abs(discrepancy) < 0.00000001;

    return this.prisma.reconciliationRecord.create({
      data: {
        date: new Date(),
        stablecoinType: dto.stablecoinType,
        systemWalletBalance: new Decimal(dto.systemBalance),
        systemMerchantPayable: new Decimal(0),
        systemCustomerBalance: new Decimal(0),
        blockchainBalance: new Decimal(dto.actualBalance),
        discrepancy: new Decimal(discrepancy),
        isReconciled,
        resolvedBy: isReconciled ? performedBy : null,
        resolutionNotes: dto.notes,
      },
    });
  }

  /**
   * Get reconciliation records
   */
  async getReconciliations(dto: ReconciliationFilterDto) {
    const page = dto.page || 1;
    const limit = dto.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (dto.status) {
      // Map status to isReconciled boolean
      where.isReconciled = dto.status === 'MATCHED';
    }
    if (dto.startDate) {
      where.date = { ...where.date, gte: new Date(dto.startDate) };
    }
    if (dto.endDate) {
      where.date = { ...where.date, lte: new Date(dto.endDate) };
    }

    const [records, total] = await Promise.all([
      this.prisma.reconciliationRecord.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.reconciliationRecord.count({ where }),
    ]);

    return {
      records: records.map((r) => ({
        ...r,
        systemWalletBalance: r.systemWalletBalance.toString(),
        systemMerchantPayable: r.systemMerchantPayable.toString(),
        systemCustomerBalance: r.systemCustomerBalance.toString(),
        blockchainBalance: r.blockchainBalance.toString(),
        discrepancy: r.discrepancy.toString(),
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
   * Resolve a discrepancy
   */
  async resolveDiscrepancy(
    recordId: string,
    resolution: string,
    resolvedBy: string,
  ) {
    const record = await this.prisma.reconciliationRecord.findUnique({
      where: { id: recordId },
    });

    if (!record) {
      throw new NotFoundException('Reconciliation record not found');
    }

    return this.prisma.reconciliationRecord.update({
      where: { id: recordId },
      data: {
        isReconciled: true,
        resolvedAt: new Date(),
        resolvedBy,
        resolutionNotes: `${record.resolutionNotes || ''}\nResolution: ${resolution}`.trim(),
      },
    });
  }

  /**
   * Get dashboard summary for admin
   */
  async getAdminDashboardSummary() {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfYear = new Date(today.getFullYear(), 0, 1);

    const [
      monthlyRevenue,
      yearlyRevenue,
      pendingSettlements,
      merchantCount,
      orderStats,
    ] = await Promise.all([
      // Monthly revenue
      this.prisma.platformRevenue.aggregate({
        where: { createdAt: { gte: startOfMonth } },
        _sum: { revenueAmount: true },
      }),
      // Yearly revenue
      this.prisma.platformRevenue.aggregate({
        where: { createdAt: { gte: startOfYear } },
        _sum: { revenueAmount: true },
      }),
      // Pending settlements
      this.prisma.settlement.aggregate({
        where: { status: { in: ['PENDING', 'APPROVED', 'PROCESSING'] } },
        _sum: { netAmount: true },
        _count: true,
      }),
      // Active merchants
      this.prisma.seller.count({
        where: { verifiedAt: { not: null } },
      }),
      // Order stats this month
      this.prisma.order.aggregate({
        where: {
          createdAt: { gte: startOfMonth },
          status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] },
        },
        _sum: { totalAmount: true },
        _count: true,
      }),
    ]);

    return {
      revenue: {
        thisMonth: monthlyRevenue._sum.revenueAmount?.toString() || '0',
        thisYear: yearlyRevenue._sum.revenueAmount?.toString() || '0',
      },
      settlements: {
        pendingCount: pendingSettlements._count,
        pendingAmount: pendingSettlements._sum.netAmount?.toString() || '0',
      },
      merchants: {
        activeCount: merchantCount,
      },
      orders: {
        thisMonthCount: orderStats._count,
        thisMonthAmount: orderStats._sum.totalAmount?.toString() || '0',
      },
    };
  }
}
