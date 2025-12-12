import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { OtpService } from '../services/otp.service';
import { EmailService } from '../services/email.service';
import { TwilioService } from '../services/twilio.service';
import { TokenService } from '../services/token.service';
import { SendOtpDto } from '../dto/send-otp.dto';
import { VerifyOtpDto } from '../dto/verify-otp.dto';

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

    if (!phoneNumber || !countryCode) {
      throw new BadRequestException(
        'Phone number and country code are required',
      );
    }

    // Normalize input
    const normalizedEmail = email.toLowerCase();
    const fullPhoneNumber = `${countryCode}${phoneNumber}`;

    // Check if user exists with this email
    const userByEmail = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // Check if user exists with this phone number
    const userByPhone = await this.prisma.user.findFirst({
      where: {
        phoneNumber: phoneNumber,
        countryCode: countryCode,
      },
    });

    // Validation: Email and phone must both be new OR both belong to same user
    if (userByEmail && userByPhone) {
      // Both exist - check if they belong to the same user
      if (userByEmail.id !== userByPhone.id) {
        throw new BadRequestException(
          'Email and phone number are registered to different accounts. Please use matching credentials.',
        );
      }
      // Same user - proceed with login
    } else if (userByEmail && !userByPhone) {
      // Email exists but phone doesn't match
      throw new BadRequestException(
        'Email is already registered with a different phone number. Please use the correct phone number.',
      );
    } else if (!userByEmail && userByPhone) {
      // Phone exists but email doesn't match
      throw new BadRequestException(
        'Phone number is already registered with a different email. Please use the correct email.',
      );
    }
    // Both are new - allow registration

    // Generate separate OTPs for email and phone
    const emailOtp = this.otpService.storeOtp(normalizedEmail, 'email');
    const phoneOtp = this.otpService.storeOtp(fullPhoneNumber, 'phone');

    // Extract first name from email or use default
    const firstName = email.split('@')[0];

    // Send OTP via SendGrid email
    await this.emailService.sendOtpEmail(email, emailOtp, firstName);

    // Send SMS OTP (in development, just log it)
    if (this.twilioService.isEnabled()) {
      this.twilioService.sendOtp(countryCode, phoneNumber, phoneOtp);
    } else {
      // Development mode - log phone OTP
      this.logger.log(`Phone OTP for ${fullPhoneNumber}: ${phoneOtp}`);
    }

    this.logger.log(`OTPs sent to ${email} and ${fullPhoneNumber}`);

    return {
      message: 'OTP sent successfully to your email and phone number',
      expiresIn: 600, // 10 minutes
      requiresBothOtp: true,
    };
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto) {
    const { email, emailOtp, phoneOtp, countryCode, phoneNumber } =
      verifyOtpDto;

    // Normalize input
    const normalizedEmail = email.toLowerCase();
    const fullPhoneNumber = `${countryCode}${phoneNumber}`;

    // Verify email OTP
    const isEmailOtpValid = this.otpService.verifyOtp(
      normalizedEmail,
      emailOtp,
      'email',
    );

    if (!isEmailOtpValid) {
      throw new BadRequestException('Invalid or expired email OTP');
    }

    // Verify phone OTP
    const isPhoneOtpValid = this.otpService.verifyOtp(
      fullPhoneNumber,
      phoneOtp,
      'phone',
    );

    if (!isPhoneOtpValid) {
      throw new BadRequestException('Invalid or expired phone OTP');
    }

    // Find or create user
    let user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: normalizedEmail,
          phoneNumber: phoneNumber,
          countryCode: countryCode,
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
