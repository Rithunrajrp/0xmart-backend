import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module';
import { EncryptionService } from './services/encryption.service';
import { RecaptchaService } from './services/recaptcha.service';

/**
 * Common Module
 *
 * Global module that exports commonly used services across the application
 */
@Global()
@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [EncryptionService, RecaptchaService],
  exports: [EncryptionService, RecaptchaService],
})
export class CommonModule {}
