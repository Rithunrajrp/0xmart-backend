import { Injectable, Logger } from '@nestjs/common';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';

@Injectable()
export class TwoFactorService {
  private readonly logger = new Logger(TwoFactorService.name);
  private readonly appName = '0xMart';

  /**
   * Generate a new TOTP secret for a user
   * @param email - User's email
   * @returns Object with secret and QR code data URL
   */
  async generateSecret(email: string): Promise<{
    secret: string;
    qrCodeUrl: string;
    otpauthUrl: string;
  }> {
    try {
      // Generate random secret
      const secret = authenticator.generateSecret();

      // Generate otpauth URL for QR code
      const otpauthUrl = authenticator.keyuri(email, this.appName, secret);

      // Generate QR code as data URL
      const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);

      this.logger.log(`2FA secret generated for ${email}`);

      return {
        secret,
        qrCodeUrl,
        otpauthUrl,
      };
    } catch (error) {
      this.logger.error('Failed to generate 2FA secret', error.stack);
      throw new Error('Failed to generate 2FA secret');
    }
  }

  /**
   * Verify a TOTP token against a secret
   * @param token - 6-digit TOTP token
   * @param secret - User's TOTP secret
   * @returns True if token is valid
   */
  verifyToken(token: string, secret: string): boolean {
    try {
      // Remove any whitespace from token
      const cleanToken = token.replace(/\s/g, '');

      // Verify with a window of 1 (allows for clock drift)
      const isValid = authenticator.verify({
        token: cleanToken,
        secret,
      });

      if (!isValid) {
        this.logger.warn('Invalid 2FA token provided');
      }

      return isValid;
    } catch (error) {
      this.logger.error('2FA token verification failed', error.stack);
      return false;
    }
  }

  /**
   * Generate a backup code (for account recovery)
   * @returns 12-character alphanumeric code
   */
  generateBackupCode(): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 12; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return code;
  }

  /**
   * Generate multiple backup codes
   * @param count - Number of backup codes to generate
   * @returns Array of backup codes
   */
  generateBackupCodes(count: number = 10): string[] {
    return Array.from({ length: count }, () => this.generateBackupCode());
  }
}
