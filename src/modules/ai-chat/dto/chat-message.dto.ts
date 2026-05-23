import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChatMessageDto {
  @ApiProperty({
    description: 'User message content',
    example: 'I need a wireless keyboard under 50 USDT',
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({
    description: 'Session ID for conversation continuity',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsOptional()
  sessionId?: string;

  @ApiPropertyOptional({
    description: 'Context information (current page, product ID, etc.)',
    example: { page: 'product', productId: '123' },
  })
  @IsOptional()
  context?: Record<string, any>;
}

export class ChatResponseDto {
  @ApiProperty({
    description: 'AI assistant response',
    example: 'I found 5 wireless keyboards under 50 USDT. Here are the top options...',
  })
  response: string;

  @ApiProperty({
    description: 'Session ID for conversation continuity',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  sessionId: string;

  @ApiPropertyOptional({
    description: 'Suggested products',
    type: 'array',
    items: { type: 'object' },
  })
  suggestedProducts?: any[];

  @ApiPropertyOptional({
    description: 'Action buttons for the user',
    type: 'array',
    items: { type: 'string' },
    example: ['View Products', 'Refine Search'],
  })
  actions?: string[];
}
