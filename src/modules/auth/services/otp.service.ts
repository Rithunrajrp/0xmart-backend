import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

interface OtpRecord {
  email: string;
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
    return crypto.randomInt(100000, 999999).toString();
  }

  storeOtp(email: string): string {
    const otp = this.generateOtp();
    const expiresAt = new Date(Date.now() + this.OTP_EXPIRATION);

    this.otpStore.set(email.toLowerCase(), {
      email: email.toLowerCase(),
      otp,
      expiresAt,
      attempts: 0,
    });

    // Clean up expired OTPs periodically
    this.cleanupExpiredOtps();

    this.logger.log(`OTP generated for ${email}: ${otp}`); // Remove in production
    return otp;
  }

  verifyOtp(email: string, otp: string): boolean {
    const record = this.otpStore.get(email.toLowerCase());

    if (!record) {
      this.logger.warn(`No OTP found for ${email}`);
      return false;
    }

    // Check expiration
    if (new Date() > record.expiresAt) {
      this.logger.warn(`OTP expired for ${email}`);
      this.otpStore.delete(email.toLowerCase());
      return false;
    }

    // Check attempts
    if (record.attempts >= this.MAX_ATTEMPTS) {
      this.logger.warn(`Max attempts reached for ${email}`);
      this.otpStore.delete(email.toLowerCase());
      return false;
    }

    // Increment attempts
    record.attempts++;

    // Verify OTP
    if (record.otp === otp) {
      this.logger.log(`OTP verified successfully for ${email}`);
      this.otpStore.delete(email.toLowerCase());
      return true;
    }

    this.logger.warn(`Invalid OTP for ${email}. Attempts: ${record.attempts}`);
    return false;
  }

  private cleanupExpiredOtps() {
    const now = new Date();
    for (const [email, record] of this.otpStore.entries()) {
      if (now > record.expiresAt) {
        this.otpStore.delete(email);
      }
    }
  }
}
