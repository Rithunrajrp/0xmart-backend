import { Controller, Get, Query, UseGuards, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ChatAnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { UserRole } from '@prisma/client';

@ApiTags('Chat Analytics')
@Controller('chat-analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChatAnalyticsController {
  constructor(private analyticsService: ChatAnalyticsService) {}

  /**
   * Get user preference insights for the authenticated user
   */
  @Get('my-preferences')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get my chat preferences',
    description: 'Analyze your chat history to understand your shopping preferences and behavior',
  })
  @ApiResponse({
    status: 200,
    description: 'User preference insights',
  })
  async getMyPreferences(@CurrentUser() user: AuthenticatedUser) {
    return this.analyticsService.getUserPreferences(user.id);
  }

  /**
   * Get user preference insights for a specific user (admin only)
   */
  @Get('user-preferences/:userId')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get user chat preferences (Admin)',
    description: 'Analyze a specific user\'s chat history (admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'User preference insights',
  })
  async getUserPreferences(@Param('userId') userId: string) {
    return this.analyticsService.getUserPreferences(userId);
  }

  /**
   * Get platform-wide analytics (admin only)
   */
  @Get('platform')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get platform-wide chat analytics (Admin)',
    description: 'Analyze all chat data across the platform for insights',
  })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Platform-wide analytics',
  })
  async getPlatformAnalytics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.analyticsService.getPlatformAnalytics(start, end);
  }

  /**
   * Get product interest analysis (admin only)
   */
  @Get('product-interest')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get product interest analysis (Admin)',
    description: 'Analyze what products and categories users are most interested in',
  })
  @ApiResponse({
    status: 200,
    description: 'Product interest analysis',
  })
  async getProductInterest() {
    return this.analyticsService.getProductInterestAnalysis();
  }

  /**
   * Search chat history for keywords (admin only)
   */
  @Get('search')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Search chat history (Admin)',
    description: 'Search all chat messages for specific keywords',
  })
  @ApiQuery({ name: 'keyword', required: true, type: String })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Search results',
  })
  async searchChatHistory(
    @Query('keyword') keyword: string,
    @Query('userId') userId?: string,
  ) {
    return this.analyticsService.searchChatHistory(keyword, userId);
  }
}
