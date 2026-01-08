import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as twilio from 'twilio';

@Injectable()
export class TwilioService {
  private readonly logger = new Logger(TwilioService.name);
  private twilioEnabled: boolean;
  private twilioClient: twilio.Twilio | null = null;
  private verifyServiceSid: string | null = null;

  constructor(private configService: ConfigService) {
    const accountSid = this.configService.get<string>('twilio.accountSid');
    const authToken = this.configService.get<string>('twilio.authToken');
    this.verifyServiceSid = this.configService.get<string>('twilio.verifyServiceSid') || null;
    const nodeEnv = this.configService.get<string>('nodeEnv');

    this.twilioEnabled = !!(accountSid && authToken && this.verifyServiceSid);

    if (this.twilioEnabled) {
      try {
        this.twilioClient = twilio.default(accountSid, authToken);
        this.logger.log(`Twilio Verify service initialized successfully (${nodeEnv} mode)`);
        this.logger.log(`Using Account SID: ${accountSid?.substring(0, 10)}...`);
        this.logger.log(`Using Verify Service SID: ${this.verifyServiceSid?.substring(0, 10)}...`);
      } catch (error) {
        this.logger.error('Failed to initialize Twilio client', error);
        this.twilioEnabled = false;
      }
    } else {
      this.logger.warn('Twilio is not configured. SMS will not be sent.');
      if (!accountSid) this.logger.warn('Missing: TWILIO_ACCOUNT_SID or TWILIO_TEST_ACCOUNT_SID');
      if (!authToken) this.logger.warn('Missing: TWILIO_AUTH_TOKEN or TWILIO_TEST_AUTH_TOKEN');
      if (!this.verifyServiceSid) this.logger.warn('Missing: TWILIO_VERIFY_SERVICE_SID or TWILIO_TEST_VERIFY_SERVICE_SID');
    }
  }

  /**
   * Send OTP via Twilio Verify API
   * Uses Twilio's managed verification service - no phone number purchase needed
   * Returns true if SMS was sent successfully, false otherwise (allows graceful fallback)
   */
  async sendOtp(countryCode: string, phoneNumber: string): Promise<boolean> {
    if (!this.twilioEnabled || !this.twilioClient || !this.verifyServiceSid) {
      this.logger.warn('Twilio is not configured. SMS will not be sent.');
      this.logger.log(`[DEV MODE] SMS OTP would be sent to ${countryCode}${phoneNumber}`);
      return false;
    }

    try {
      const fullPhoneNumber = `${countryCode}${phoneNumber}`;

      const verification = await this.twilioClient.verify.v2
        .services(this.verifyServiceSid)
        .verifications.create({
          to: fullPhoneNumber,
          channel: 'sms',
        });

      this.logger.log(`SMS OTP sent to ${fullPhoneNumber}, status: ${verification.status}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send SMS OTP to ${countryCode}${phoneNumber}`);
      this.logger.error(error.message || error);

      // Don't throw exception - allow graceful fallback to dev mode
      return false;
    }
  }

  /**
   * Verify OTP using Twilio Verify API
   */
  async verifyOtp(countryCode: string, phoneNumber: string, code: string): Promise<boolean> {
    if (!this.twilioEnabled || !this.twilioClient || !this.verifyServiceSid) {
      this.logger.warn('Twilio is not configured. Skipping SMS verification.');
      return true; // Allow verification to pass in dev mode
    }

    try {
      const fullPhoneNumber = `${countryCode}${phoneNumber}`;

      const verificationCheck = await this.twilioClient.verify.v2
        .services(this.verifyServiceSid)
        .verificationChecks.create({
          to: fullPhoneNumber,
          code: code,
        });

      const isValid = verificationCheck.status === 'approved';

      if (isValid) {
        this.logger.log(`Phone verification successful for ${fullPhoneNumber}`);
      } else {
        this.logger.warn(`Phone verification failed for ${fullPhoneNumber}, status: ${verificationCheck.status}`);
      }

      return isValid;
    } catch (error) {
      this.logger.error(`Failed to verify OTP for ${countryCode}${phoneNumber}`);
      this.logger.error(error.message || error);
      // Return false to allow fallback to local OTP verification
      return false;
    }
  }

  isEnabled(): boolean {
    return this.twilioEnabled;
  }
}
