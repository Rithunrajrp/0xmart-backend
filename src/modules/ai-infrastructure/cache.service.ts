import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
}

@Injectable()
export class AICacheService implements OnModuleDestroy {
  private readonly logger = new Logger(AICacheService.name);
  private redis: Redis;
  private initialized: boolean = false;
  private readonly defaultTTL = 3600; // 1 hour
  private connectionErrorLogged: boolean = false;

  constructor(private configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    const redisHost = this.configService.get<string>('REDIS_HOST');
    const redisPort = this.configService.get<number>('REDIS_PORT');
    const redisPassword = this.configService.get<string>('REDIS_PASSWORD');

    // Skip Redis if no configuration provided
    if (!redisUrl && !redisHost) {
      this.logger.log('Redis not configured. AI caching disabled (optional feature).');
      return;
    }

    try {
      if (redisUrl) {
        this.redis = new Redis(redisUrl, {
          retryStrategy: (times) => {
            // Stop retrying after 3 attempts
            if (times > 3) {
              this.logger.warn('Redis connection failed after 3 attempts. Caching disabled.');
              return null;
            }
            return Math.min(times * 1000, 3000);
          },
          maxRetriesPerRequest: 3,
          enableReadyCheck: false,
          lazyConnect: true,
        });
      } else {
        this.redis = new Redis({
          host: redisHost,
          port: redisPort || 6379,
          password: redisPassword,
          retryStrategy: (times) => {
            if (times > 3) {
              this.logger.warn('Redis connection failed after 3 attempts. Caching disabled.');
              return null;
            }
            return Math.min(times * 1000, 3000);
          },
          maxRetriesPerRequest: 3,
          enableReadyCheck: false,
          lazyConnect: true,
        });
      }

      this.redis.on('connect', () => {
        this.logger.log('✓ Redis connected - AI caching enabled');
        this.initialized = true;
        this.connectionErrorLogged = false;
      });

      this.redis.on('error', (error) => {
        // Only log the first error to avoid spam
        if (!this.connectionErrorLogged) {
          this.logger.warn(
            `Redis connection failed: ${error.message}. AI caching disabled (this is optional).`
          );
          this.connectionErrorLogged = true;
        }
        this.initialized = false;
      });

      // Attempt to connect
      this.redis.connect().catch(() => {
        // Silently fail - already logged in error handler
      });

    } catch (error) {
      this.logger.warn(`Redis initialization failed: ${error.message}. AI caching disabled.`);
    }
  }

  /**
   * Set a value in cache
   */
  async set(
    key: string,
    value: any,
    options: CacheOptions = {},
  ): Promise<void> {
    if (!this.initialized) {
      return; // Silently skip if not initialized
    }

    try {
      const cacheKey = this.getCacheKey(key, options.prefix);
      const serialized = JSON.stringify(value);
      const ttl = options.ttl || this.defaultTTL;

      await this.redis.setex(cacheKey, ttl, serialized);
    } catch (error) {
      this.logger.error(`Cache set error for key ${key}: ${error.message}`);
    }
  }

  /**
   * Get a value from cache
   */
  async get<T>(
    key: string,
    options: CacheOptions = {},
  ): Promise<T | null> {
    if (!this.initialized) {
      return null; // Return null if not initialized
    }

    try {
      const cacheKey = this.getCacheKey(key, options.prefix);
      const cached = await this.redis.get(cacheKey);

      if (!cached) {
        return null;
      }

      return JSON.parse(cached) as T;
    } catch (error) {
      this.logger.error(`Cache get error for key ${key}: ${error.message}`);
      return null;
    }
  }

  /**
   * Delete a value from cache
   */
  async delete(
    key: string,
    options: CacheOptions = {},
  ): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      const cacheKey = this.getCacheKey(key, options.prefix);
      await this.redis.del(cacheKey);
    } catch (error) {
      this.logger.error(`Cache delete error for key ${key}: ${error.message}`);
    }
  }

  /**
   * Delete all keys matching a pattern
   */
  async deletePattern(
    pattern: string,
    options: CacheOptions = {},
  ): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      const cachePattern = this.getCacheKey(pattern, options.prefix);
      const keys = await this.redis.keys(cachePattern);

      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      this.logger.error(`Cache delete pattern error for ${pattern}: ${error.message}`);
    }
  }

  /**
   * Check if a key exists in cache
   */
  async exists(
    key: string,
    options: CacheOptions = {},
  ): Promise<boolean> {
    if (!this.initialized) {
      return false;
    }

    try {
      const cacheKey = this.getCacheKey(key, options.prefix);
      const result = await this.redis.exists(cacheKey);
      return result === 1;
    } catch (error) {
      this.logger.error(`Cache exists error for key ${key}: ${error.message}`);
      return false;
    }
  }

  /**
   * Set expiration time for a key
   */
  async expire(
    key: string,
    ttl: number,
    options: CacheOptions = {},
  ): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      const cacheKey = this.getCacheKey(key, options.prefix);
      await this.redis.expire(cacheKey, ttl);
    } catch (error) {
      this.logger.error(`Cache expire error for key ${key}: ${error.message}`);
    }
  }

  /**
   * Increment a value in cache
   */
  async increment(
    key: string,
    options: CacheOptions = {},
  ): Promise<number> {
    if (!this.initialized) {
      return 0;
    }

    try {
      const cacheKey = this.getCacheKey(key, options.prefix);
      const result = await this.redis.incr(cacheKey);

      // Set TTL if this is a new key
      const ttl = options.ttl || this.defaultTTL;
      await this.redis.expire(cacheKey, ttl);

      return result;
    } catch (error) {
      this.logger.error(`Cache increment error for key ${key}: ${error.message}`);
      return 0;
    }
  }

  /**
   * Get or set a value (useful for cache-aside pattern)
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options: CacheOptions = {},
  ): Promise<T> {
    const cached = await this.get<T>(key, options);

    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, options);

    return value;
  }

  /**
   * Build cache key with optional prefix
   */
  private getCacheKey(key: string, prefix?: string): string {
    const finalPrefix = prefix || 'ai';
    return `${finalPrefix}:${key}`;
  }

  /**
   * Check if cache is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit();
    }
  }
}
