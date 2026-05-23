import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { OxlienSettingsService } from './oxlien-settings.service';
import { OxlienSettingsController } from './oxlien-settings.controller';

@Module({
  imports: [PrismaModule],
  controllers: [OxlienSettingsController],
  providers: [OxlienSettingsService],
  exports: [OxlienSettingsService],
})
export class OxlienModule {}
