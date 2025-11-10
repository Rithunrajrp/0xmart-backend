import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VerifyOtpDto } from '../dto/verify-otp.dto';

@Injectable()
export class TwilioService {
  verifyOtp(verifyOtpDto: VerifyOtpDto): Promise<boolean> {
    throw new Error(
      `Method not implemented. phonenumber: ${verifyOtpDto.email}`,
    );
  }
  private readonly logger = new Logger(TwilioService.name);
  private twilioEnabled: boolean;

  constructor(private configService: ConfigService) {
    this.twilioEnabled = !!this.configService.get<string>('twilio.accountSid');
  }

  sendOtp(countryCode: string, phoneNumber: string, otp: string): void {
    if (!this.twilioEnabled) {
      this.logger.warn('Twilio is not configured. SMS will not be sent.');
      return;
    }

    // TODO: Implement Twilio SMS sending when enabled
    this.logger.log(
      `SMS OTP would be sent to ${countryCode}${phoneNumber}: ${otp}`,
    );
  }

  isEnabled(): boolean {
    return this.twilioEnabled;
  }
}
