import { Module } from '@nestjs/common';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeysService } from './api-keys.service';
import { ApiKeyGuard } from './guards/api-key.guard';
import { PrismaModule } from '../../../prisma/prisma.module';
import { SmartContractModule } from '../smart-contract/smart-contract.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [PrismaModule, SmartContractModule, SettingsModule],
  controllers: [ApiKeysController],
  providers: [ApiKeysService, ApiKeyGuard],
  exports: [ApiKeysService, ApiKeyGuard],
})
export class ApiKeysModule {}
