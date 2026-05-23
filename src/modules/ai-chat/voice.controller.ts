import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  Body,
  Res,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBearerAuth,
} from '@nestjs/swagger';
import * as express from 'express';
import { VoiceService } from './voice.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import * as AuthTypes from '../../common/interfaces/authenticated-user.interface';
type AuthenticatedUser = AuthTypes.AuthenticatedUser;

@ApiTags('AI Voice')
@ApiBearerAuth()
@UseGuards(ThrottlerGuard)
@Controller('ai/chat')
export class VoiceController {
  constructor(private readonly voiceService: VoiceService) {}

  /**
   * Text-to-speech: converts text to audio/mp3 via OpenAI TTS.
   * Accepts JSON body, returns raw audio blob.
   * Rate limited to 10 requests per minute per user.
   */
  @Post('tts')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Convert text to speech (OpenAI TTS) - Requires authentication' })
  @ApiResponse({ status: 200, description: 'Audio blob (audio/mp3)' })
  async tts(
    @Body() body: { text: string; voiceId?: string; speed?: number },
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: express.Response,
  ): Promise<void> {
    if (!body.text?.trim()) {
      throw new HttpException('Text is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const audioBuffer = await this.voiceService.synthesize(
        body.text.trim(),
        body.voiceId || 'alloy',
        body.speed ?? 1.0,
      );

      res.set('Content-Type', 'audio/mp3');
      res.set('Content-Length', audioBuffer.length.toString());
      res.send(audioBuffer);
    } catch (error) {
      throw new HttpException(
        error.message,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Speech-to-text: transcribes uploaded audio via OpenAI Whisper.
   * Accepts multipart/form-data with field name "audio".
   * Rate limited to 10 requests per minute per user.
   */
  @Post('whisper')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseInterceptors(FileInterceptor('audio'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Transcribe audio (OpenAI Whisper) - Requires authentication' })
  @ApiResponse({ status: 200, description: '{ text: string }' })
  async whisper(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ text: string }> {
    if (!file) {
      throw new HttpException(
        'Audio file is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const text = await this.voiceService.transcribe(
        file.buffer,
        file.originalname || 'audio.webm',
      );

      return { text };
    } catch (error) {
      throw new HttpException(
        error.message,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
