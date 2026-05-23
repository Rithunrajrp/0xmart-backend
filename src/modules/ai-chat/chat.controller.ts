import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  Param,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ChatAgentService } from './chat-agent.service';
import { SessionService } from './session.service';
import { ChatMessageDto, ChatResponseDto } from './dto/chat-message.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('AI Chat')
@Controller('ai/chat')
export class ChatController {
  constructor(
    private chatAgent: ChatAgentService,
    private sessionService: SessionService,
  ) {}

  @Public()
  @Post()
  @ApiOperation({
    summary: 'Send a message to Oxlien AI assistant',
    description: 'Chat with the AI shopping assistant. Works for both authenticated and guest users.',
  })
  @ApiResponse({
    status: 200,
    description: 'AI response generated successfully',
    type: ChatResponseDto,
  })
  async chat(
    @Body() dto: ChatMessageDto,
    @CurrentUser() user?: any,
  ): Promise<ChatResponseDto> {
    const response = await this.chatAgent.chat(
      dto.message,
      dto.sessionId,
      user?.id,
      dto.context,
    );

    return {
      response: response.message,
      sessionId: response.sessionId,
      suggestedProducts: response.products,
      actions: response.actions,
    };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('sessions/:sessionId')
  @ApiOperation({
    summary: 'Get chat session history',
    description: 'Retrieve message history for a specific chat session. Requires authentication.',
  })
  @ApiResponse({
    status: 200,
    description: 'Session history retrieved successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Session does not belong to user',
  })
  @ApiResponse({
    status: 404,
    description: 'Session not found',
  })
  async getSession(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const session = await this.sessionService.getSession(sessionId);

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    // Verify ownership - session must belong to authenticated user
    if (session.userId !== user.id) {
      throw new ForbiddenException('You do not have access to this session');
    }

    return session;
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('sessions')
  @ApiOperation({
    summary: 'Get user chat sessions',
    description: 'Retrieve all chat sessions for the authenticated user',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of sessions to return',
  })
  @ApiResponse({
    status: 200,
    description: 'User sessions retrieved successfully',
  })
  async getUserSessions(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: number,
  ) {
    return this.sessionService.getUserSessions(
      user.id,
      { limit: limit || 10 },
    );
  }

  @Get('sessions/:sessionId/messages')
  @ApiOperation({
    summary: 'Get session messages',
    description: 'Retrieve all messages for a specific chat session',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of messages to return',
  })
  @ApiResponse({
    status: 200,
    description: 'Session messages retrieved successfully',
  })
  async getSessionMessages(
    @Param('sessionId') sessionId: string,
    @Query('limit') limit?: number,
  ) {
    const messages = await this.sessionService.getMessages(
      sessionId,
      limit,
    );

    return {
      messages,
      count: messages.length,
    };
  }
}
