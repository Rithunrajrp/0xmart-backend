import { Module } from '@nestjs/common';
import { MerchantOnboardingService } from './merchant-onboarding.service';
import { MerchantOnboardingController } from './merchant-onboarding.controller';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [MerchantOnboardingService],
  controllers: [MerchantOnboardingController],
  exports: [MerchantOnboardingService],
})
export class MerchantOnboardingModule {}
