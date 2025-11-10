import { Module } from '@nestjs/common';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';
import { SumsubService } from './services/sumsub.service';
import { MockKycService } from './services/mock-kyc.service';
import { EmailService } from '../auth/services/email.service';

@Module({
  controllers: [KycController],
  providers: [KycService, SumsubService, MockKycService, EmailService],
  exports: [KycService],
})
export class KycModule {}
