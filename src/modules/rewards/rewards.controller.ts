import { Controller, Get, Patch, Param, Query, UseGuards, Body } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { RewardsService } from './rewards.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('rewards')
@Controller('rewards')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class RewardsController {
  constructor(private readonly rewardsService: RewardsService) {}

  @Get('my-rewards')
  @ApiOperation({ summary: 'Get current user rewards' })
  @ApiResponse({ status: 200 })
  getMyRewards(@CurrentUser() user: any, @Query('status') status?: string) {
    return this.rewardsService.getUserRewards(user.id, status);
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get reward statistics' })
  @ApiResponse({ status: 200 })
  getStatistics(@CurrentUser() user: any) {
    return this.rewardsService.getRewardStatistics(user.id);
  }

  @Patch(':rewardId/claim')
  @ApiOperation({ summary: 'Claim a reward' })
  @ApiResponse({ status: 200 })
  claimReward(@Param('rewardId') rewardId: string, @CurrentUser() user: any) {
    return this.rewardsService.claimReward(rewardId, user.id);
  }

  // Admin endpoints
  @Get('admin/all')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all rewards (Admin only)' })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200 })
  getAllRewards(
    @Query('userId') userId?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.rewardsService.getAllRewards({
      userId,
      status,
      type,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Get('admin/statistics')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get rewards statistics (Admin only)' })
  @ApiResponse({ status: 200 })
  getAdminStatistics() {
    return this.rewardsService.getAdminStatistics();
  }

  @Get('admin/user/:userId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get user rewards (Admin only)' })
  @ApiQuery({ name: 'status', required: false })
  @ApiResponse({ status: 200 })
  getAdminUserRewards(
    @Param('userId') userId: string,
    @Query('status') status?: string,
  ) {
    return this.rewardsService.getUserRewards(userId, status);
  }

  @Get('admin/:rewardId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get reward by ID (Admin only)' })
  @ApiResponse({ status: 200 })
  getRewardById(@Param('rewardId') rewardId: string) {
    return this.rewardsService.getRewardById(rewardId);
  }

  @Patch('admin/:rewardId/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update reward status (Admin only)' })
  @ApiResponse({ status: 200 })
  updateRewardStatus(
    @Param('rewardId') rewardId: string,
    @Body('status') status: string,
  ) {
    return this.rewardsService.updateRewardStatus(rewardId, status);
  }
}
