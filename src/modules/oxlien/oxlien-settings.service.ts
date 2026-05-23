import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export interface AutoPayCheckResult {
  allowed: boolean;
  reason?: string;
}

/** Whitelisted field names for OxlienSettings updates. */
const SETTINGS_FIELDS = [
  'enabled',
  'aiModel',
  'autoPayEnabled',
  'autoPayPerOrder',
  'autoPayDaily',
  'autoPayMonthly',
  'allowedStablecoins',
  'allowedNetworks',
  'voiceInputEnabled',
  'voiceOutputEnabled',
  'voiceId',
  'voiceSpeed',
] as const;

@Injectable()
export class OxlienSettingsService {
  constructor(private prisma: PrismaService) {}

  /** Get or create settings for a user (upsert with all defaults). */
  async getOrCreate(userId: string) {
    return this.prisma.oxlienSettings.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  /** Update settings — only whitelisted fields are written. */
  async update(userId: string, raw: Record<string, unknown>) {
    const data: Record<string, unknown> = {};
    for (const key of SETTINGS_FIELDS) {
      if (raw[key] !== undefined) data[key] = raw[key];
    }

    return this.prisma.oxlienSettings.upsert({
      where: { userId },
      create: { userId, ...data } as any,
      update: data as any,
    });
  }

  /**
   * Server-side auto-pay limit check.
   * Returns { allowed: true } when all guards pass, otherwise
   * { allowed: false, reason: '...' }.
   */
  async checkAutoPayLimits(
    userId: string,
    orderTotal: number,
    stablecoin: string,
    network: string,
  ): Promise<AutoPayCheckResult> {
    const settings = await this.prisma.oxlienSettings.findUnique({
      where: { userId },
    });

    if (!settings || !settings.autoPayEnabled) {
      return { allowed: false, reason: 'Auto-pay is not enabled.' };
    }

    // ── per-order cap ──
    const perOrder = settings.autoPayPerOrder.toNumber();
    if (perOrder > 0 && orderTotal > perOrder) {
      return {
        allowed: false,
        reason: `Order total ($${orderTotal.toFixed(2)}) exceeds per-order limit ($${perOrder}).`,
      };
    }

    // ── stablecoin allowlist ──
    if (
      settings.allowedStablecoins.length > 0 &&
      !settings.allowedStablecoins.includes(stablecoin.toUpperCase())
    ) {
      return {
        allowed: false,
        reason: `Stablecoin ${stablecoin} is not in your allowed list.`,
      };
    }

    // ── network allowlist ──
    if (
      settings.allowedNetworks.length > 0 &&
      !settings.allowedNetworks.includes(network.toUpperCase())
    ) {
      return {
        allowed: false,
        reason: `Network ${network} is not in your allowed list.`,
      };
    }

    // ── rolling 24-h spend (auto-pay orders only) ──
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dailyAgg = await this.prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: {
        userId,
        autoPayUsed: true,
        createdAt: { gte: dayAgo },
        status: { notIn: ['CANCELLED', 'REFUNDED'] as any },
      },
    });
    const dailyTotal = dailyAgg._sum?.totalAmount?.toNumber() ?? 0;
    const dailyLimit = settings.autoPayDaily.toNumber();
    if (dailyLimit > 0 && dailyTotal + orderTotal > dailyLimit) {
      return {
        allowed: false,
        reason: `Daily spend would reach $${(dailyTotal + orderTotal).toFixed(2)}, exceeding the $${dailyLimit} limit.`,
      };
    }

    // ── rolling 30-d spend (auto-pay orders only) ──
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const monthlyAgg = await this.prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: {
        userId,
        autoPayUsed: true,
        createdAt: { gte: monthAgo },
        status: { notIn: ['CANCELLED', 'REFUNDED'] as any },
      },
    });
    const monthlyTotal = monthlyAgg._sum?.totalAmount?.toNumber() ?? 0;
    const monthlyLimit = settings.autoPayMonthly.toNumber();
    if (monthlyLimit > 0 && monthlyTotal + orderTotal > monthlyLimit) {
      return {
        allowed: false,
        reason: `Monthly spend would reach $${(monthlyTotal + orderTotal).toFixed(2)}, exceeding the $${monthlyLimit} limit.`,
      };
    }

    return { allowed: true };
  }
}
