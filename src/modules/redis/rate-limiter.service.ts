import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';

/**
 * SEC-BE-004 FIX: Redis-based Rate Limiting Service
 *
 * Provides distributed rate limiting that works across multiple server instances
 * and serverless environments. Falls back to in-memory for development.
 */
@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);
  // Fallback in-memory cache if Redis unavailable
  private memoryCache = new Map<string, { count: number; resetAt: number }>();

  constructor(private readonly redisService: RedisService) {}

  /**
   * Check if request is within rate limit
   * @param key Unique identifier (e.g., apiKeyId, userId, IP address)
   * @param limit Maximum number of requests
   * @param windowSeconds Time window in seconds
   * @returns Object with allowed status and remaining count
   */
  async checkRateLimit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: Date;
    limit: number;
  }> {
    const rateLimitKey = `ratelimit:${key}`;

    if (this.redisService.isAvailable()) {
      return this.checkRateLimitRedis(rateLimitKey, limit, windowSeconds);
    } else {
      this.logger.warn(
        '⚠️  Redis unavailable, using in-memory rate limiting (NOT PRODUCTION SAFE)',
      );
      return this.checkRateLimitMemory(key, limit, windowSeconds);
    }
  }

  /**
   * Redis-based rate limiting (production-safe, distributed)
   */
  private async checkRateLimitRedis(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: Date;
    limit: number;
  }> {
    try {
      // Increment counter
      const count = await this.redisService.incr(key);

      // Set expiry on first request
      if (count === 1) {
        await this.redisService.expire(key, windowSeconds);
      }

      // Get TTL to calculate reset time
      const ttl = await this.redisService.ttl(key);
      const resetAt = new Date(Date.now() + ttl * 1000);

      const remaining = Math.max(0, limit - count);
      const allowed = count <= limit;

      return {
        allowed,
        remaining,
        resetAt,
        limit,
      };
    } catch (error) {
      this.logger.error(`Redis rate limit check failed: ${error.message}`);
      // Fallback to memory
      return this.checkRateLimitMemory(key, limit, windowSeconds);
    }
  }

  /**
   * In-memory rate limiting (fallback, NOT production-safe)
   */
  private checkRateLimitMemory(
    key: string,
    limit: number,
    windowSeconds: number,
  ): {
    allowed: boolean;
    remaining: number;
    resetAt: Date;
    limit: number;
  } {
    const now = Date.now();
    const cached = this.memoryCache.get(key);

    // Reset if window expired
    if (!cached || cached.resetAt < now) {
      const resetAt = new Date(now + windowSeconds * 1000);
      this.memoryCache.set(key, { count: 1, resetAt: resetAt.getTime() });
      return {
        allowed: true,
        remaining: limit - 1,
        resetAt,
        limit,
      };
    }

    // Check if exceeded
    if (cached.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(cached.resetAt),
        limit,
      };
    }

    // Increment count
    cached.count++;
    this.memoryCache.set(key, cached);

    return {
      allowed: true,
      remaining: limit - cached.count,
      resetAt: new Date(cached.resetAt),
      limit,
    };
  }

  /**
   * Check multiple rate limits simultaneously
   * Useful for checking both per-minute and per-day limits
   */
  async checkMultipleRateLimits(
    key: string,
    limits: Array<{ limit: number; windowSeconds: number; name: string }>,
  ): Promise<{
    allowed: boolean;
    limits: Array<{
      name: string;
      allowed: boolean;
      remaining: number;
      resetAt: Date;
      limit: number;
    }>;
  }> {
    const results = await Promise.all(
      limits.map(async ({ limit, windowSeconds, name }) => {
        const result = await this.checkRateLimit(
          `${key}:${name}`,
          limit,
          windowSeconds,
        );
        return { name, ...result };
      }),
    );

    const allowed = results.every((r) => r.allowed);

    return { allowed, limits: results };
  }

  /**
   * Reset rate limit for a key (admin function)
   */
  async resetRateLimit(key: string): Promise<void> {
    const rateLimitKey = `ratelimit:${key}`;

    if (this.redisService.isAvailable()) {
      await this.redisService.del(rateLimitKey);
    }

    this.memoryCache.delete(key);
    this.logger.log(`Rate limit reset for key: ${key}`);
  }

  /**
   * Clean up expired memory cache entries (scheduled task)
   */
  cleanupMemoryCache(): void {
    const now = Date.now();
    for (const [key, value] of this.memoryCache.entries()) {
      if (value.resetAt < now) {
        this.memoryCache.delete(key);
      }
    }
  }
}
