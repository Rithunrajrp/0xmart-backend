import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { KycService } from './kyc.service';
import { SubmitKycDto } from './dto/submit-kyc.dto';
import { KycWebhookDto } from './dto/webhook-kyc.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UserRole, KYCStatus } from '@prisma/client';
import { KycSessionEntity } from './entities/kyc.entity';

@ApiTags('kyc')
@Controller('kyc')
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('initiate')
  @ApiOperation({ summary: 'Initiate KYC verification' })
  @ApiResponse({ status: 201, type: KycSessionEntity })
  async initiateKyc(
    @CurrentUser() user: any,
    @Body() submitKycDto: SubmitKycDto,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return this.kycService.initiateKyc(user.id, submitKycDto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('status')
  @ApiOperation({ summary: 'Get KYC verification status' })
  @ApiResponse({ status: 200 })
  async getStatus(@CurrentUser() user: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return this.kycService.getKycStatus(user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('retry')
  @ApiOperation({ summary: 'Retry KYC verification after rejection' })
  @ApiResponse({ status: 201, type: KycSessionEntity })
  async retryKyc(@CurrentUser() user: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return this.kycService.retryKyc(user.id);
  }

  @Public()
  @Post('webhook')
  @ApiOperation({ summary: 'Webhook endpoint for KYC provider' })
  @ApiResponse({ status: 200 })
  async handleWebhook(@Body() webhookData: KycWebhookDto) {
    return this.kycService.handleWebhook(webhookData);
  }

  // Admin routes
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Get('admin/applications')
  @ApiOperation({ summary: 'Get all KYC applications (Admin only)' })
  @ApiQuery({ name: 'status', required: false, enum: KYCStatus })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200 })
  async getAllApplications(
    @Query('status') status?: KYCStatus,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.kycService.getAllKycApplications({ status, page, limit });
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Patch('admin/:userId/approve')
  @ApiOperation({ summary: 'Manually approve KYC (Admin only)' })
  @ApiResponse({ status: 200 })
  async manualApprove(
    @Param('userId') userId: string,
    @CurrentUser() admin: any,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return this.kycService.manualApprove(userId, admin.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Patch('admin/:userId/reject')
  @ApiOperation({ summary: 'Manually reject KYC (Admin only)' })
  @ApiResponse({ status: 200 })
  async manualReject(
    @Param('userId') userId: string,
    @Body() body: { reason: string },
    @CurrentUser() admin: any,
  ) {
    return this.kycService.manualReject(
      userId,
      body.reason,
      admin.id as string,
    );
  }

  // Testing endpoints (only work with mock service)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('test/approve')
  @ApiOperation({ summary: 'Test: Approve mock KYC (Development only)' })
  @ApiResponse({ status: 200 })
  async mockApprove(@CurrentUser() user: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return this.kycService.mockApprove(user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('test/reject')
  @ApiOperation({ summary: 'Test: Reject mock KYC (Development only)' })
  @ApiResponse({ status: 200 })
  async mockReject(@CurrentUser() user: any, @Body() body: { reason: string }) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return this.kycService.mockReject(user.id, body.reason);
  }
}
