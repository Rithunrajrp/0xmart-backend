import { Controller, Get, Post, Delete, Patch, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam, ApiBody } from '@nestjs/swagger';
import { SessionService } from './session.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { UserRole } from '@prisma/client';

class UpdateSessionTitleDto {
  title: string;
}

@ApiTags('Chat Sessions')
@Controller('chat/sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SessionController {
  constructor(private sessionService: SessionService) {}

  /**
   * Get list of user's chat sessions
   */
  @Get()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get my chat sessions',
    description: 'Retrieve all chat sessions for the authenticated user, including read-only (expired) sessions',
  })
  @ApiQuery({
    name: 'includeReadOnly',
    required: false,
    type: Boolean,
    description: 'Include read-only sessions in results (default: true)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of sessions to return (default: 50)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of user chat sessions',
    schema: {
      example: {
        sessions: [
          {
            id: 'session-uuid',
            title: 'Lip balm purchase on Sui network',
            isReadOnly: false,
            lastMessage: 'Perfect! Placing your order now...',
            lastUpdated: '2025-01-15T10:30:00Z',
            messageCount: 12,
            hasOrder: true,
          },
        ],
        total: 5,
      },
    },
  })
  async listSessions(
    @CurrentUser() user: AuthenticatedUser,
    @Query('includeReadOnly') includeReadOnly?: string,
    @Query('limit') limit?: string,
  ) {
    const include = includeReadOnly !== 'false'; // Default to true
    const maxResults = limit ? parseInt(limit, 10) : 50;
    return this.sessionService.getUserSessions(user.id, {
      includeReadOnly: include,
      limit: maxResults,
    });
  }

  /**
   * Create a new chat session
   */
  @Post()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create new chat session',
    description: 'Start a new chat conversation',
  })
  @ApiResponse({
    status: 201,
    description: 'New session created successfully',
    schema: {
      example: {
        id: 'session-uuid',
        userId: 'user-uuid',
        title: null,
        isReadOnly: false,
        createdAt: '2025-01-15T10:30:00Z',
      },
    },
  })
  async createSession(@CurrentUser() user: AuthenticatedUser) {
    return this.sessionService.createSession(user.id);
  }

  /**
   * Get session details with message history
   */
  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get session details',
    description: 'Retrieve a specific chat session with its message history',
  })
  @ApiParam({
    name: 'id',
    description: 'Session ID',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Session details retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Session not found or access denied',
  })
  async getSession(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.sessionService.getSession(id, user.id);
  }

  /**
   * Delete a chat session
   */
  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete chat session',
    description: 'Permanently delete a chat session and all its messages',
  })
  @ApiParam({
    name: 'id',
    description: 'Session ID',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Session deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Session not found or access denied',
  })
  async deleteSession(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.sessionService.deleteSession(id, user.id);
  }

  /**
   * Update session title
   */
  @Patch(':id/title')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update session title',
    description: 'Rename a chat session',
  })
  @ApiParam({
    name: 'id',
    description: 'Session ID',
    type: String,
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', example: 'My custom session name' },
      },
      required: ['title'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Session title updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Session not found or access denied',
  })
  async updateTitle(
    @Param('id') id: string,
    @Body() dto: UpdateSessionTitleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sessionService.updateTitle(id, dto.title, user.id);
  }

  /**
   * Admin: Get any user's sessions
   */
  @Get('admin/user/:userId')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get user chat sessions (Admin)',
    description: 'Retrieve all chat sessions for a specific user (admin only)',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'User chat sessions retrieved successfully',
  })
  async getUserSessionsAdmin(@Param('userId') userId: string) {
    return this.sessionService.getUserSessions(userId, { includeReadOnly: true });
  }
}
