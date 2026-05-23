import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI, { toFile } from 'openai';

@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);
  private openai: OpenAI;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.openai = new OpenAI({ apiKey: apiKey || 'dummy' });
  }

  /**
   * Transcribe audio to text using OpenAI Whisper.
   */
  async transcribe(audioBuffer: Buffer, filename: string): Promise<string> {
    try {
      const file = await toFile(audioBuffer, filename, { type: 'audio/webm' });

      const response = await this.openai.audio.transcriptions.create({
        file,
        model: 'whisper-1',
      });

      return response.text;
    } catch (error) {
      this.logger.error(
        `Whisper transcription error: ${error.message}`,
        error.stack,
      );
      throw new Error(`Transcription failed: ${error.message}`);
    }
  }

  /**
   * Synthesize text to audio using OpenAI TTS.
   * Returns an audio/mp3 Buffer.
   */
  async synthesize(
    text: string,
    voiceId: string = 'alloy',
    speed: number = 1.0,
  ): Promise<Buffer> {
    try {
      const clampedSpeed = Math.max(0.25, Math.min(4.0, speed));

      const response = await this.openai.audio.speech.create({
        model: 'tts-1-hd',
        input: text,
        voice: voiceId as
          | 'alloy'
          | 'echo'
          | 'fable'
          | 'onyx'
          | 'nova'
          | 'shimmer',
        speed: clampedSpeed,
      });

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      this.logger.error(
        `TTS synthesis error: ${error.message}`,
        error.stack,
      );
      throw new Error(`Speech synthesis failed: ${error.message}`);
    }
  }
}
