import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

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
  private readonly otpStore = new Map<string, OtpRecord>();
  private readonly OTP_EXPIRATION = 10 * 60 * 1000; // 10 minutes
  private readonly MAX_ATTEMPTS = 5;

  generateOtp(): string {
    // Development bypass - always return demo OTP
    if (process.env.NODE_ENV === 'development') {
      return '123456';
    }
    return crypto.randomInt(100000, 999999).toString();
  }

  storeOtp(identifier: string, type: 'email' | 'phone'): string {
    const otp = this.generateOtp();
    const expiresAt = new Date(Date.now() + this.OTP_EXPIRATION);
    const key = `${type}:${identifier.toLowerCase()}`;

    this.otpStore.set(key, {
      identifier: identifier.toLowerCase(),
      type,
      otp,
      expiresAt,
      attempts: 0,
    });

    // Clean up expired OTPs periodically
    this.cleanupExpiredOtps();

    // OTP logging in development only
    if (process.env.NODE_ENV === 'development') {
      this.logger.log(
        `Development OTP for ${type} ${identifier}: ${otp} (demo mode)`,
      );
    }
    return otp;
  }

  verifyOtp(identifier: string, otp: string, type: 'email' | 'phone'): boolean {
    const key = `${type}:${identifier.toLowerCase()}`;
    const record = this.otpStore.get(key);

    if (!record) {
      this.logger.warn(`No OTP found for ${type} ${identifier}`);
      return false;
    }

    // Check expiration
    if (new Date() > record.expiresAt) {
      this.logger.warn(`OTP expired for ${type} ${identifier}`);
      this.otpStore.delete(key);
      return false;
    }

    // Check attempts
    if (record.attempts >= this.MAX_ATTEMPTS) {
      this.logger.warn(`Max attempts reached for ${type} ${identifier}`);
      this.otpStore.delete(key);
      return false;
    }

    // Increment attempts
    record.attempts++;

    // Verify OTP
    if (record.otp === otp) {
      this.logger.log(`OTP verified successfully for ${type} ${identifier}`);
      this.otpStore.delete(key);
      return true;
    }

    this.logger.warn(
      `Invalid OTP for ${type} ${identifier}. Attempts: ${record.attempts}`,
    );
    return false;
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
