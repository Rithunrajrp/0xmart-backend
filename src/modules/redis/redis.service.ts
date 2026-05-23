import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    try {
      const redisUrl = this.configService.get<string>('REDIS_URL');
      const redisHost = this.configService.get<string>('REDIS_HOST');
      const redisPort = this.configService.get<number>('REDIS_PORT');
      const redisPassword = this.configService.get<string>('REDIS_PASSWORD');

      // Use REDIS_URL if available, otherwise construct from host/port
      if (redisUrl) {
        this.client = new Redis(redisUrl, {
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          lazyConnect: true,
        });
      } else if (redisHost && redisPort) {
        this.client = new Redis({
          host: redisHost,
          port: redisPort,
          password: redisPassword || undefined,
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          lazyConnect: true,
        });
      } else {
        this.logger.warn(
          '⚠️  Redis not configured. Falling back to in-memory storage. NOT PRODUCTION SAFE!',
        );
        return;
      }

      await this.client.connect();
      this.logger.log('✅ Redis connection established successfully');
    } catch (error) {
      this.logger.error('❌ Failed to connect to Redis:', error.message);
      this.logger.warn(
        '⚠️  Falling back to in-memory storage. NOT PRODUCTION SAFE!',
      );
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
      this.logger.log('Redis connection closed');
    }
  }

  /**
   * Check if Redis is available
   */
  isAvailable(): boolean {
    return this.client?.status === 'ready';
  }

  /**
   * Get a value from Redis
   */
  async get(key: string): Promise<string | null> {
    if (!this.isAvailable()) {
      throw new Error('Redis is not available');
    }
    return this.client.get(key);
  }

  /**
   * Set a value in Redis
   * @param key Redis key
   * @param value Value to store
   * @param expiryMode Expiry mode: 'EX' for seconds, 'PX' for milliseconds
   * @param time Time to live
   */
  async set(
    key: string,
    value: string,
    expiryMode?: 'EX' | 'PX',
    time?: number,
  ): Promise<'OK'> {
    if (!this.isAvailable()) {
      throw new Error('Redis is not available');
    }

    if (expiryMode && time) {
      // Use ioredis API correctly
      if (expiryMode === 'EX') {
        return this.client.set(key, value, 'EX', time) as Promise<'OK'>;
      } else {
        return this.client.set(key, value, 'PX', time) as Promise<'OK'>;
      }
    }
    return this.client.set(key, value) as Promise<'OK'>;
  }

  /**
   * Set a value with expiration in seconds
   */
  async setex(key: string, seconds: number, value: string): Promise<'OK'> {
    if (!this.isAvailable()) {
      throw new Error('Redis is not available');
    }
    return this.client.setex(key, seconds, value);
  }

  /**
   * Delete a key from Redis
   */
  async del(key: string): Promise<number> {
    if (!this.isAvailable()) {
      throw new Error('Redis is not available');
    }
    return this.client.del(key);
  }

  /**
   * Delete multiple keys from Redis
   */
  async delMultiple(...keys: string[]): Promise<number> {
    if (!this.isAvailable()) {
      throw new Error('Redis is not available');
    }
    return this.client.del(...keys);
  }

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<number> {
    if (!this.isAvailable()) {
      throw new Error('Redis is not available');
    }
    return this.client.exists(key);
  }

  /**
   * Get time to live for a key in seconds
   */
  async ttl(key: string): Promise<number> {
    if (!this.isAvailable()) {
      throw new Error('Redis is not available');
    }
    return this.client.ttl(key);
  }

  /**
   * Set expiration on a key in seconds
   */
  async expire(key: string, seconds: number): Promise<number> {
    if (!this.isAvailable()) {
      throw new Error('Redis is not available');
    }
    return this.client.expire(key, seconds);
  }

  /**
   * Increment a key
   */
  async incr(key: string): Promise<number> {
    if (!this.isAvailable()) {
      throw new Error('Redis is not available');
    }
    return this.client.incr(key);
  }

  /**
   * Increment a key by a specific amount
   */
  async incrby(key: string, increment: number): Promise<number> {
    if (!this.isAvailable()) {
      throw new Error('Redis is not available');
    }
    return this.client.incrby(key, increment);
  }

  /**
   * Decrement a key
   */
  async decr(key: string): Promise<number> {
    if (!this.isAvailable()) {
      throw new Error('Redis is not available');
    }
    return this.client.decr(key);
  }

  /**
   * Get all keys matching a pattern
   */
  async keys(pattern: string): Promise<string[]> {
    if (!this.isAvailable()) {
      throw new Error('Redis is not available');
    }
    return this.client.keys(pattern);
  }

  /**
   * Store a hash field
   */
  async hset(key: string, field: string, value: string): Promise<number> {
    if (!this.isAvailable()) {
      throw new Error('Redis is not available');
    }
    return this.client.hset(key, field, value);
  }

  /**
   * Get a hash field
   */
  async hget(key: string, field: string): Promise<string | null> {
    if (!this.isAvailable()) {
      throw new Error('Redis is not available');
    }
    return this.client.hget(key, field);
  }

  /**
   * Get all hash fields
   */
  async hgetall(key: string): Promise<Record<string, string>> {
    if (!this.isAvailable()) {
      throw new Error('Redis is not available');
    }
    return this.client.hgetall(key);
  }

  /**
   * Delete a hash field
   */
  async hdel(key: string, field: string): Promise<number> {
    if (!this.isAvailable()) {
      throw new Error('Redis is not available');
    }
    return this.client.hdel(key, field);
  }

  /**
   * Add members to a set
   */
  async sadd(key: string, ...members: string[]): Promise<number> {
    if (!this.isAvailable()) {
      throw new Error('Redis is not available');
    }
    return this.client.sadd(key, ...members);
  }

  /**
   * Get all members of a set
   */
  async smembers(key: string): Promise<string[]> {
    if (!this.isAvailable()) {
      throw new Error('Redis is not available');
    }
    return this.client.smembers(key);
  }

  /**
   * Check if a member is in a set
   */
  async sismember(key: string, member: string): Promise<number> {
    if (!this.isAvailable()) {
      throw new Error('Redis is not available');
    }
    return this.client.sismember(key, member);
  }

  /**
   * Remove a member from a set
   */
  async srem(key: string, member: string): Promise<number> {
    if (!this.isAvailable()) {
      throw new Error('Redis is not available');
    }
    return this.client.srem(key, member);
  }
}
