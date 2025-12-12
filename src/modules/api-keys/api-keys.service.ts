import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  limit: number;
}

interface UsageStats {
  total: number;
  thisMonth: number;
  quota: number;
  remaining: number;
  tier: string;
}

@Injectable()
export class ApiKeysService {
  private readonly logger = new Logger(ApiKeysService.name);

  // In-memory rate limit tracking (use Redis in production)
  private rateLimitCache = new Map<string, { count: number; resetAt: Date }>();

  // Subscription tier limits
  private readonly tierLimits = {
    free: { monthlyQuota: 1000, rateLimitPerMinute: 30, rateLimitPerDay: 1000 },
    basic: {
      monthlyQuota: 10000,
      rateLimitPerMinute: 60,
      rateLimitPerDay: 10000,
    },
    pro: {
      monthlyQuota: 100000,
      rateLimitPerMinute: 120,
      rateLimitPerDay: 50000,
    },
    enterprise: {
      monthlyQuota: 1000000,
      rateLimitPerMinute: 300,
      rateLimitPerDay: 200000,
    },
  };

  constructor(private prisma: PrismaService) {}

  /**
   * Generate a new API key
   * Format: xmart_<random_32_chars>
   */
  private generateApiKey(): string {
    const randomBytes = crypto.randomBytes(24);
    const key = `xmart_${randomBytes.toString('base64url')}`;
    return key;
  }

  /**
   * Generate API secret for HMAC signature verification
   * Format: xms_<random_32_chars>
   */
  private generateApiSecret(): string {
    const randomBytes = crypto.randomBytes(32);
    return `xms_${randomBytes.toString('base64url')}`;
  }

  /**
   * Hash API key/secret for storage
   */
  private async hashKey(key: string): Promise<string> {
    return bcrypt.hash(key, 10);
  }

  /**
   * Get prefix (first 8 chars) for identification
   */
  private getKeyPrefix(key: string): string {
    return key.substring(0, 8);
  }

  /**
   * Create a new API key for user
   */
  async createApiKey(
    userId: string,
    name: string,
    options?: {
      expiresInDays?: number;
      subscriptionTier?: string;
      webhookUrl?: string;
      supportedNetworks?: string[]; // Array of NetworkType values
    },
  ): Promise<{
    id: string;
    name: string;
    apiKey: string;
    apiSecret: string;
    prefix: string;
    tier: string;
    supportedNetworks: string[];
    createdAt: Date;
    expiresAt?: Date;
  }> {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check user status
    if (user.status !== 'ACTIVE') {
      throw new BadRequestException('User account is not active');
    }

    // Validate supported networks
    if (!options?.supportedNetworks || options.supportedNetworks.length === 0) {
      throw new BadRequestException('At least one network must be selected');
    }

    // Validate network values
    const validNetworks = [
      'ETHEREUM',
      'POLYGON',
      'BSC',
      'ARBITRUM',
      'OPTIMISM',
      'AVALANCHE',
      'BASE',
      'SUI',
      'TON',
      'SOLANA',
    ];
    const invalidNetworks = options.supportedNetworks.filter(
      (n) => !validNetworks.includes(n),
    );
    if (invalidNetworks.length > 0) {
      throw new BadRequestException(
        `Invalid networks: ${invalidNetworks.join(', ')}`,
      );
    }

    // Generate API key and secret
    const apiKey = this.generateApiKey();
    const apiSecret = this.generateApiSecret();
    const keyHash = await this.hashKey(apiKey);
    const secretHash = await this.hashKey(apiSecret);
    const prefix = this.getKeyPrefix(apiKey);

    // Calculate expiration date
    let expiresAt: Date | undefined;
    if (options?.expiresInDays) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + options.expiresInDays);
    }

    // Get tier limits
    const tier = options?.subscriptionTier || 'free';
    const tierConfig = this.tierLimits[tier] || this.tierLimits.free;

    // Generate webhook secret if webhook URL provided
    let webhookSecret: string | undefined;
    if (options?.webhookUrl) {
      webhookSecret = crypto.randomBytes(32).toString('hex');
    }

    // Create API key record
    const apiKeyRecord = await this.prisma.apiKey.create({
      data: {
        userId,
        name,
        keyHash,
        secretHash,
        prefix,
        expiresAt,
        status: 'ACTIVE',
        supportedNetworks: options.supportedNetworks as any[], // Cast to NetworkType[]
        subscriptionTier: tier,
        monthlyQuota: tierConfig.monthlyQuota,
        rateLimitPerMinute: tierConfig.rateLimitPerMinute,
        rateLimitPerDay: tierConfig.rateLimitPerDay,
        webhookUrl: options?.webhookUrl,
        webhookSecret,
        billingResetAt: this.getNextBillingResetDate(),
        creationFeePaid: false, // Will be updated after payment
      },
    });

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'ADMIN_ACTION',
        entityType: 'api_key',
        entityId: apiKeyRecord.id,
        metadata: {
          action: 'create',
          name,
          prefix,
          tier,
        },
      },
    });

    this.logger.log(`API key created for user ${userId}: ${prefix}...`);

    // Return the plain keys only once (user must save them)
    return {
      id: apiKeyRecord.id,
      name: apiKeyRecord.name,
      supportedNetworks: apiKeyRecord.supportedNetworks as string[],
      apiKey, // Only returned once!
      apiSecret, // Only returned once!
      prefix: apiKeyRecord.prefix,
      tier,
      createdAt: apiKeyRecord.createdAt,
      expiresAt: apiKeyRecord.expiresAt || undefined,
    };
  }

  /**
   * Rotate API key (generate new key, keep same settings)
   */
  async rotateApiKey(
    userId: string,
    apiKeyId: string,
  ): Promise<{ apiKey: string; apiSecret: string; prefix: string }> {
    const existing = await this.prisma.apiKey.findFirst({
      where: { id: apiKeyId, userId },
    });

    if (!existing) {
      throw new NotFoundException('API key not found');
    }

    if (existing.status !== 'ACTIVE') {
      throw new BadRequestException('Cannot rotate inactive API key');
    }

    // Generate new credentials
    const apiKey = this.generateApiKey();
    const apiSecret = this.generateApiSecret();
    const keyHash = await this.hashKey(apiKey);
    const secretHash = await this.hashKey(apiSecret);
    const prefix = this.getKeyPrefix(apiKey);

    // Update the key
    await this.prisma.apiKey.update({
      where: { id: apiKeyId },
      data: {
        keyHash,
        secretHash,
        prefix,
        updatedAt: new Date(),
      },
    });

    // Clear rate limit cache for old key
    this.rateLimitCache.delete(apiKeyId);

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'ADMIN_ACTION',
        entityType: 'api_key',
        entityId: apiKeyId,
        metadata: {
          action: 'rotate',
          oldPrefix: existing.prefix,
          newPrefix: prefix,
        },
      },
    });

    this.logger.log(`API key rotated: ${existing.prefix}... -> ${prefix}...`);

    return { apiKey, apiSecret, prefix };
  }

  /**
   * List all API keys for a user
   */
  async getUserApiKeys(userId: string) {
    const apiKeys = await this.prisma.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        prefix: true,
        status: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
        revokedAt: true,
        subscriptionTier: true,
        monthlyQuota: true,
        usageThisMonth: true,
        rateLimitPerMinute: true,
        rateLimitPerDay: true,
        webhookUrl: true,
        billingResetAt: true,
      },
    });

    // Check for expired keys
    const now = new Date();
    for (const key of apiKeys) {
      if (key.status === 'ACTIVE' && key.expiresAt && key.expiresAt < now) {
        await this.prisma.apiKey.update({
          where: { id: key.id },
          data: { status: 'EXPIRED' },
        });
        key.status = 'EXPIRED';
      }
    }

    return apiKeys;
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(userId: string, apiKeyId: string) {
    const apiKey = await this.prisma.apiKey.findFirst({
      where: {
        id: apiKeyId,
        userId,
      },
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    if (apiKey.status === 'REVOKED') {
      throw new BadRequestException('API key already revoked');
    }

    const updated = await this.prisma.apiKey.update({
      where: { id: apiKeyId },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
      },
    });

    // Clear rate limit cache
    this.rateLimitCache.delete(apiKeyId);

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'ADMIN_ACTION',
        entityType: 'api_key',
        entityId: apiKeyId,
        metadata: {
          action: 'revoke',
          prefix: apiKey.prefix,
        },
      },
    });

    this.logger.log(`API key revoked: ${apiKey.prefix}...`);

    return updated;
  }

  /**
   * Delete an API key permanently
   */
  async deleteApiKey(userId: string, apiKeyId: string) {
    const apiKey = await this.prisma.apiKey.findFirst({
      where: {
        id: apiKeyId,
        userId,
      },
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    await this.prisma.apiKey.delete({
      where: { id: apiKeyId },
    });

    // Clear rate limit cache
    this.rateLimitCache.delete(apiKeyId);

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'ADMIN_ACTION',
        entityType: 'api_key',
        entityId: apiKeyId,
        metadata: {
          action: 'delete',
          prefix: apiKey.prefix,
        },
      },
    });

    this.logger.log(`API key deleted: ${apiKey.prefix}...`);

    return { message: 'API key deleted successfully' };
  }

  /**
   * Validate API key and return user info
   */
  async validateApiKey(apiKey: string): Promise<{
    userId: string;
    apiKeyId: string;
    tier: string;
  } | null> {
    if (!apiKey || !apiKey.startsWith('xmart_')) {
      return null;
    }

    const prefix = this.getKeyPrefix(apiKey);

    // Find API key by prefix
    const apiKeyRecord = await this.prisma.apiKey.findFirst({
      where: {
        prefix,
        status: 'ACTIVE',
      },
      include: {
        user: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!apiKeyRecord) {
      return null;
    }

    // Check if expired
    if (apiKeyRecord.expiresAt && apiKeyRecord.expiresAt < new Date()) {
      await this.prisma.apiKey.update({
        where: { id: apiKeyRecord.id },
        data: { status: 'EXPIRED' },
      });
      return null;
    }

    // Check user status
    if (apiKeyRecord.user.status !== 'ACTIVE') {
      return null;
    }

    // Verify the key hash
    const isValid = await bcrypt.compare(apiKey, apiKeyRecord.keyHash);
    if (!isValid) {
      return null;
    }

    // Update last used timestamp
    await this.prisma.apiKey.update({
      where: { id: apiKeyRecord.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      userId: apiKeyRecord.userId,
      apiKeyId: apiKeyRecord.id,
      tier: apiKeyRecord.subscriptionTier,
    };
  }

  /**
   * Verify HMAC signature for request authentication
   */
  async verifySignature(
    apiKeyId: string,
    signature: string,
    payload: string,
    timestamp: string,
  ): Promise<boolean> {
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { id: apiKeyId },
    });

    if (!apiKey || !apiKey.secretHash) {
      return false;
    }

    // Check timestamp is within 5 minutes
    const requestTime = parseInt(timestamp, 10);
    const now = Date.now();
    if (Math.abs(now - requestTime) > 5 * 60 * 1000) {
      return false;
    }

    // Reconstruct expected signature
    const message = `${timestamp}.${payload}`;
    const expectedSignature = crypto
      .createHmac('sha256', apiKey.secretHash)
      .update(message)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    );
  }

  /**
   * Check rate limit for API key
   */
  async checkRateLimit(apiKeyId: string): Promise<RateLimitResult> {
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { id: apiKeyId },
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    const now = new Date();
    const cacheKey = `${apiKeyId}:minute`;
    const cached = this.rateLimitCache.get(cacheKey);

    // Reset if window expired
    if (!cached || cached.resetAt < now) {
      const resetAt = new Date(now.getTime() + 60000); // 1 minute window
      this.rateLimitCache.set(cacheKey, { count: 1, resetAt });
      return {
        allowed: true,
        remaining: apiKey.rateLimitPerMinute - 1,
        resetAt,
        limit: apiKey.rateLimitPerMinute,
      };
    }

    // Check if exceeded
    if (cached.count >= apiKey.rateLimitPerMinute) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: cached.resetAt,
        limit: apiKey.rateLimitPerMinute,
      };
    }

    // Increment count
    cached.count++;
    this.rateLimitCache.set(cacheKey, cached);

    return {
      allowed: true,
      remaining: apiKey.rateLimitPerMinute - cached.count,
      resetAt: cached.resetAt,
      limit: apiKey.rateLimitPerMinute,
    };
  }

  /**
   * Check monthly quota for API key
   */
  async checkQuota(
    apiKeyId: string,
  ): Promise<{ allowed: boolean; usage: UsageStats }> {
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { id: apiKeyId },
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    // Reset usage if billing period expired
    if (apiKey.billingResetAt && apiKey.billingResetAt < new Date()) {
      await this.prisma.apiKey.update({
        where: { id: apiKeyId },
        data: {
          usageThisMonth: 0,
          billingResetAt: this.getNextBillingResetDate(),
        },
      });
      apiKey.usageThisMonth = 0;
    }

    const usage: UsageStats = {
      total: apiKey.usageThisMonth,
      thisMonth: apiKey.usageThisMonth,
      quota: apiKey.monthlyQuota,
      remaining: Math.max(0, apiKey.monthlyQuota - apiKey.usageThisMonth),
      tier: apiKey.subscriptionTier,
    };

    return {
      allowed: apiKey.usageThisMonth < apiKey.monthlyQuota,
      usage,
    };
  }

  /**
   * Increment usage counter for API key
   */
  async incrementUsage(apiKeyId: string): Promise<void> {
    await this.prisma.apiKey.update({
      where: { id: apiKeyId },
      data: {
        usageThisMonth: { increment: 1 },
      },
    });
  }

  /**
   * Log API usage
   */
  async logUsage(data: {
    apiKeyId: string;
    endpoint: string;
    method: string;
    statusCode: number;
    responseTimeMs: number;
    ipAddress?: string;
    userAgent?: string;
    requestBody?: any;
  }): Promise<void> {
    await this.prisma.apiUsageLog.create({
      data: {
        apiKeyId: data.apiKeyId,
        endpoint: data.endpoint,
        method: data.method,
        statusCode: data.statusCode,
        responseTimeMs: data.responseTimeMs,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        requestBody: data.requestBody,
      },
    });

    // Increment usage counter
    await this.incrementUsage(data.apiKeyId);
  }

  /**
   * Get API key statistics for a user
   */
  async getApiKeyStats(userId: string) {
    const [total, active, revoked, expired] = await Promise.all([
      this.prisma.apiKey.count({ where: { userId } }),
      this.prisma.apiKey.count({
        where: { userId, status: 'ACTIVE' },
      }),
      this.prisma.apiKey.count({
        where: { userId, status: 'REVOKED' },
      }),
      this.prisma.apiKey.count({
        where: { userId, status: 'EXPIRED' },
      }),
    ]);

    return {
      total,
      active,
      revoked,
      expired,
    };
  }

  /**
   * Get usage analytics for an API key
   */
  async getUsageAnalytics(userId: string, apiKeyId: string, days: number = 30) {
    const apiKey = await this.prisma.apiKey.findFirst({
      where: { id: apiKeyId, userId },
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const usageLogs = await this.prisma.apiUsageLog.groupBy({
      by: ['endpoint'],
      where: {
        apiKeyId,
        createdAt: { gte: startDate },
      },
      _count: { id: true },
      _avg: { responseTimeMs: true },
    });

    const dailyUsage = await this.prisma.apiUsageLog.groupBy({
      by: ['createdAt'],
      where: {
        apiKeyId,
        createdAt: { gte: startDate },
      },
      _count: { id: true },
    });

    return {
      apiKeyId,
      period: `${days} days`,
      totalRequests: usageLogs.reduce((sum, log) => sum + log._count.id, 0),
      endpointBreakdown: usageLogs.map((log) => ({
        endpoint: log.endpoint,
        count: log._count.id,
        avgResponseTime: Math.round(log._avg.responseTimeMs || 0),
      })),
      dailyUsage,
      quota: {
        used: apiKey.usageThisMonth,
        limit: apiKey.monthlyQuota,
        remaining: Math.max(0, apiKey.monthlyQuota - apiKey.usageThisMonth),
      },
    };
  }

  /**
   * Update webhook configuration
   */
  async updateWebhook(
    userId: string,
    apiKeyId: string,
    webhookUrl: string | null,
  ): Promise<{ webhookUrl: string | null; webhookSecret: string | null }> {
    const apiKey = await this.prisma.apiKey.findFirst({
      where: { id: apiKeyId, userId },
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    let webhookSecret: string | null = null;
    if (webhookUrl) {
      webhookSecret = crypto.randomBytes(32).toString('hex');
    }

    await this.prisma.apiKey.update({
      where: { id: apiKeyId },
      data: {
        webhookUrl,
        webhookSecret,
      },
    });

    return { webhookUrl, webhookSecret };
  }

  /**
   * Update subscription tier
   */
  async updateTier(userId: string, apiKeyId: string, tier: string) {
    const apiKey = await this.prisma.apiKey.findFirst({
      where: { id: apiKeyId, userId },
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    const tierConfig = this.tierLimits[tier];
    if (!tierConfig) {
      throw new BadRequestException('Invalid subscription tier');
    }

    const updated = await this.prisma.apiKey.update({
      where: { id: apiKeyId },
      data: {
        subscriptionTier: tier,
        monthlyQuota: tierConfig.monthlyQuota,
        rateLimitPerMinute: tierConfig.rateLimitPerMinute,
        rateLimitPerDay: tierConfig.rateLimitPerDay,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'ADMIN_ACTION',
        entityType: 'api_key',
        entityId: apiKeyId,
        metadata: {
          action: 'upgrade_tier',
          oldTier: apiKey.subscriptionTier,
          newTier: tier,
        },
      },
    });

    return updated;
  }

  private getNextBillingResetDate(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }
}
