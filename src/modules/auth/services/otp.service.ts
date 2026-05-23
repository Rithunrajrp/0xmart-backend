import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { RedisService } from '../../redis/redis.service';

interface OtpRecord {
  identifier: string;
  type: 'email' | 'phone';
  otp: string;
  expiresAt: Date;
  attempts: number;
}

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  // Fallback to in-memory storage if Redis is unavailable
  private readonly otpStore = new Map<string, OtpRecord>();
  private readonly OTP_EXPIRATION = 10 * 60 * 1000; // 10 minutes
  private readonly MAX_ATTEMPTS = 5;

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  generateOtp(): string {
    // SEC-BE-002 FIX: More secure development OTP bypass
    // Only allow dev OTP if explicitly enabled AND not in production mode
    const nodeEnv = this.configService.get<string>('NODE_ENV');
    const allowDevOtp = this.configService.get<string>('ALLOW_DEV_OTP') === 'true';
    const productionMode = this.configService.get<string>('PRODUCTION_MODE') === 'true';

    if (nodeEnv === 'development' && allowDevOtp && !productionMode) {
      this.logger.warn('⚠️  Using development OTP: 123456 - DO NOT USE IN PRODUCTION');
      return '123456';
    }

    // Generate cryptographically secure random OTP
    return crypto.randomInt(100000, 999999).toString();
  }

  async storeOtp(identifier: string, type: 'email' | 'phone'): Promise<string> {
    const otp = this.generateOtp();
    const expiresAt = new Date(Date.now() + this.OTP_EXPIRATION);
    const key = `otp:${type}:${identifier.toLowerCase()}`;

    const record: OtpRecord = {
      identifier: identifier.toLowerCase(),
      type,
      otp,
      expiresAt,
      attempts: 0,
    };

    // SEC-BE-001 FIX: Use Redis for OTP storage (production-safe)
    if (this.redisService.isAvailable()) {
      try {
        // Store OTP in Redis with automatic expiration
        await this.redisService.setex(
          key,
          Math.floor(this.OTP_EXPIRATION / 1000), // Convert to seconds
          JSON.stringify(record),
        );
        this.logger.log(`OTP stored in Redis for ${type} ${identifier}`);
      } catch (error) {
        this.logger.error(`Failed to store OTP in Redis: ${error.message}`);
        // Fallback to in-memory
        this.otpStore.set(key, record);
        this.logger.warn('⚠️  Falling back to in-memory OTP storage');
      }
    } else {
      // Fallback to in-memory storage (NOT production-safe)
      this.logger.warn('⚠️  Redis unavailable, using in-memory OTP storage (NOT PRODUCTION SAFE)');
      this.otpStore.set(key, record);
      // Clean up expired OTPs periodically
      this.cleanupExpiredOtps();
    }

    // OTP logging in development only
    const nodeEnv = this.configService.get<string>('NODE_ENV');
    if (nodeEnv === 'development') {
      this.logger.log(
        `Development OTP for ${type} ${identifier}: ${otp}`,
      );
    }

    return otp;
  }

  async verifyOtp(identifier: string, otp: string, type: 'email' | 'phone'): Promise<boolean> {
    const key = `otp:${type}:${identifier.toLowerCase()}`;
    let record: OtpRecord | null = null;

    // SEC-BE-001 FIX: Retrieve OTP from Redis (production-safe)
    if (this.redisService.isAvailable()) {
      try {
        const data = await this.redisService.get(key);
        if (data) {
          record = JSON.parse(data);
          // Convert expiresAt string back to Date
          if (record) {
            record.expiresAt = new Date(record.expiresAt);
          }
        }
      } catch (error) {
        this.logger.error(`Failed to retrieve OTP from Redis: ${error.message}`);
        // Fallback to in-memory
        record = this.otpStore.get(key) || null;
      }
    } else {
      // Fallback to in-memory storage
      record = this.otpStore.get(key) || null;
    }

    if (!record) {
      this.logger.warn(`No OTP found for ${type} ${identifier}`);
      return false;
    }

    // Check expiration
    if (new Date() > record.expiresAt) {
      this.logger.warn(`OTP expired for ${type} ${identifier}`);
      await this.deleteOtp(key);
      return false;
    }

    // Check attempts
    if (record.attempts >= this.MAX_ATTEMPTS) {
      this.logger.warn(`Max attempts reached for ${type} ${identifier}`);
      await this.deleteOtp(key);
      return false;
    }

    // Increment attempts
    record.attempts++;

    // Update attempts in storage
    if (this.redisService.isAvailable()) {
      try {
        const ttl = await this.redisService.ttl(key);
        await this.redisService.setex(key, ttl > 0 ? ttl : 300, JSON.stringify(record));
      } catch (error) {
        this.logger.error(`Failed to update OTP attempts in Redis: ${error.message}`);
        // Update in-memory as fallback
        this.otpStore.set(key, record);
      }
    } else {
      this.otpStore.set(key, record);
    }

    // Verify OTP
    if (record.otp === otp) {
      this.logger.log(`OTP verified successfully for ${type} ${identifier}`);
      await this.deleteOtp(key);
      return true;
    }

    this.logger.warn(
      `Invalid OTP for ${type} ${identifier}. Attempts: ${record.attempts}`,
    );
    return false;
  }

  /**
   * Delete OTP from storage
   */
  private async deleteOtp(key: string): Promise<void> {
    if (this.redisService.isAvailable()) {
      try {
        await this.redisService.del(key);
      } catch (error) {
        this.logger.error(`Failed to delete OTP from Redis: ${error.message}`);
        // Fallback to in-memory
        this.otpStore.delete(key);
      }
    } else {
      this.otpStore.delete(key);
    }
  }

  private cleanupExpiredOtps() {
    const now = new Date();
    for (const [key, record] of this.otpStore.entries()) {
      if (now > record.expiresAt) {
        this.otpStore.delete(key);
      }
    }
  }
}
