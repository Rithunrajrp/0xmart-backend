import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { OtpService } from './services/otp.service';
import { EmailService } from './services/email.service';
import { TwilioService } from './services/twilio.service';
import { TokenService } from './services/token.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private otpService: OtpService,
    private emailService: EmailService,
    private twilioService: TwilioService,
    private tokenService: TokenService,
  ) {}

  async sendOtp(sendOtpDto: SendOtpDto) {
    const { email, countryCode, phoneNumber } = sendOtpDto;

    // Generate OTP
    const otp = this.otpService.storeOtp(email);

    // Extract first name from email or use default
    const firstName = email.split('@')[0];

    // Send OTP via SendGrid email
    await this.emailService.sendOtpEmail(email, otp, firstName);

    // If phone number provided and Twilio enabled, send SMS too
    if (phoneNumber && countryCode && this.twilioService.isEnabled()) {
      this.twilioService.sendOtp(countryCode, phoneNumber, otp);
    }

    this.logger.log(`OTP sent to ${email}`);

    return {
      message: 'OTP sent successfully to your email',
      expiresIn: 6000, // 10 minutes,
    };
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto) {
    const { email, otp } = verifyOtpDto;

    // Verify OTP
    const isValid = this.otpService.verifyOtp(email, otp);

    if (!isValid) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    // Find or create user
    let user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // Extract phone from email if pattern matches
      const phonePattern = /^(\+\d{1,4})(\d{7,15})@/;
      const phoneMatch = email.match(phonePattern);

      user = await this.prisma.user.create({
        data: {
          email: email.toLowerCase(),
          phoneNumber: phoneMatch ? `${phoneMatch[1]}${phoneMatch[2]}` : '',
          countryCode: phoneMatch ? phoneMatch[1] : '',
          role: 'USER',
          status: 'ACTIVE',
        },
      });

      this.logger.log(`New user created: ${user.id}`);
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'USER_LOGIN',
        entityType: 'user',
        entityId: user.id,
      },
    });

    // Generate tokens
    const tokens = await this.tokenService.generateTokens(
      user.id,
      user.email || '',
      user.role,
    );

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        phoneNumber: user.phoneNumber,
        countryCode: user.countryCode,
        role: user.role,
        kycStatus: user.kycStatus,
      },
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      return await this.tokenService.refreshTokens(refreshToken);
    } catch (error) {
      throw new UnauthorizedException(`Invalid refresh token ${error}`);
    }
  }

  async logout(userId: string, token: string) {
    await this.tokenService.revokeToken(token);

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'USER_LOGOUT',
        entityType: 'user',
        entityId: userId,
      },
    });

    return { message: 'Logged out successfully' };
  }

  async logoutAll(userId: string) {
    await this.tokenService.revokeAllUserTokens(userId);

    return { message: 'Logged out from all devices successfully' };
  }
}
