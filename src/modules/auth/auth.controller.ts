import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthResponseEntity } from './entities/auth-response.entity';
import { RefreshTokenDto } from './dto/refresh-token.dto';

export interface CurrentUserDto {
  id: string;
  email: string;
  phoneNumber?: string;
  countryCode?: string;
  role?: string;
  userType?: string;
  status?: string;
  kycStatus?: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send OTP to email (and phone if configured)' })
  @ApiResponse({ status: 200, description: 'OTP sent successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  sendOtp(@Body() sendOtpDto: SendOtpDto) {
    return this.authService.sendOtp(sendOtpDto);
  }

  @Public()
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify OTP and login/register' })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: AuthResponseEntity,
  })
  @ApiResponse({ status: 400, description: 'Invalid OTP' })
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.authService.verifyOtp(verifyOtpDto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout from current session' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout(
    @CurrentUser() user: CurrentUserDto,
    @Body() body: { token: string },
  ) {
    return this.authService.logout(user.id, body.token);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout from all devices' })
  @ApiResponse({ status: 200, description: 'Logged out from all devices' })
  async logoutAll(@CurrentUser() user: CurrentUserDto) {
    return this.authService.logoutAll(user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile retrieved' })
  getProfile(@CurrentUser() user: CurrentUserDto) {
    return {
      id: user.id,
      email: user.email,
      phoneNumber: user.phoneNumber,
      countryCode: user.countryCode,
      role: user.role,
      userType: user.userType,
      status: user.status,
      kycStatus: user.kycStatus,
    };
  }

  @Public()
  @Get('validate-referral-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate referral code' })
  @ApiResponse({ status: 200, description: 'Referral code validation result' })
  async validateReferralCode(@Query('code') code: string) {
    return this.authService.validateReferralCode(code);
  }
}
