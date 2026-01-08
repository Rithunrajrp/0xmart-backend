import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

interface RecaptchaResponse {
  success: boolean;
  score: number;
  action: string;
  challenge_ts: string;
  hostname: string;
  'error-codes'?: string[];
}

/**
 * reCAPTCHA V3 validation service
 *
 * Score ranges:
 * 1.0 - Very likely legitimate
 * 0.5 - Neutral
 * 0.0 - Very likely a bot
 *
 * Recommended thresholds:
 * - LOGIN: 0.5 (lenient, you have OTP backup)
 * - SIGNUP: 0.7 (stricter, prevent fake accounts)
 * - OTP_REQUEST: 0.6 (moderate, prevent OTP spam)
 * - WITHDRAWAL: 0.4 (very lenient, don't block real users)
 * - API_KEY_CREATE: 0.6 (moderate, prevent abuse)
 */
@Injectable()
export class RecaptchaService {
  private readonly logger = new Logger(RecaptchaService.name);
  private readonly secretKey: string;
  private readonly enabled: boolean;

  // Score thresholds for different actions
  private readonly thresholds = {
    LOGIN: 0.5,
    SIGNUP: 0.7,
    OTP_REQUEST: 0.6,
    WITHDRAWAL: 0.4,
    API_KEY_CREATE: 0.6,
    PASSWORD_RESET: 0.5,
    CHECKOUT: 0.5,
    FIAT_PURCHASE: 0.5,
  };

  constructor(private configService: ConfigService) {
    this.secretKey = this.configService.get<string>('recaptcha.secretKey') || '';
    this.enabled = this.secretKey.trim() !== '';

    if (!this.enabled) {
      this.logger.warn('⚠️  reCAPTCHA is DISABLED (no secret key configured)');
    } else {
      this.logger.log('✅ reCAPTCHA V3 validation enabled');
    }
  }

  /**
   * Verify reCAPTCHA token from frontend
   * @param token - reCAPTCHA token from grecaptcha.execute()
   * @param action - Action name (e.g., 'LOGIN', 'SIGNUP')
   * @param expectedAction - Optional: verify action matches expected
   * @returns Promise with validation result
   */
  async verifyToken(
    token: string,
    action: keyof typeof this.thresholds,
    expectedAction?: string,
  ): Promise<{
    success: boolean;
    score: number;
    message?: string;
  }> {
    // If reCAPTCHA is disabled, always pass (development mode)
    if (!this.enabled) {
      this.logger.debug(`reCAPTCHA disabled, skipping validation for ${action}`);
      return { success: true, score: 1.0 };
    }

    if (!token || token.trim() === '') {
      throw new BadRequestException('reCAPTCHA token is required');
    }

    try {
      const response = await axios.post<RecaptchaResponse>(
        'https://www.google.com/recaptcha/api/siteverify',
        null,
        {
          params: {
            secret: this.secretKey,
            response: token,
          },
        },
      );

      const { success, score, action: responseAction, 'error-codes': errorCodes } = response.data;

      // Log error codes if verification failed
      if (!success) {
        this.logger.warn(`reCAPTCHA verification failed: ${errorCodes?.join(', ')}`);
        return {
          success: false,
          score: 0,
          message: `reCAPTCHA verification failed: ${errorCodes?.join(', ')}`,
        };
      }

      // Verify action matches expected action
      if (expectedAction && responseAction !== expectedAction) {
        this.logger.warn(
          `reCAPTCHA action mismatch. Expected: ${expectedAction}, Got: ${responseAction}`,
        );
        return {
          success: false,
          score,
          message: `Action mismatch. Expected: ${expectedAction}, Got: ${responseAction}`,
        };
      }

      // Check score against threshold
      const threshold = this.thresholds[action];
      const passed = score >= threshold;

      if (!passed) {
        this.logger.warn(
          `reCAPTCHA score too low for ${action}. Score: ${score}, Threshold: ${threshold}`,
        );
      }

      this.logger.debug(
        `reCAPTCHA ${action} - Score: ${score}, Threshold: ${threshold}, Pass: ${passed}`,
      );

      return {
        success: passed,
        score,
        message: passed
          ? 'reCAPTCHA verification passed'
          : `Score too low. Score: ${score}, Required: ${threshold}`,
      };
    } catch (error) {
      this.logger.error(`reCAPTCHA verification error: ${error}`);
      // In case of service error, allow request to proceed (fail open)
      // This prevents blocking legitimate users if reCAPTCHA service is down
      return {
        success: true,
        score: 0.5,
        message: 'reCAPTCHA service unavailable, proceeding with request',
      };
    }
  }

  /**
   * Get threshold for a specific action
   */
  getThreshold(action: keyof typeof this.thresholds): number {
    return this.thresholds[action];
  }

  /**
   * Check if reCAPTCHA is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}
