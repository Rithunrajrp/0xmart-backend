import { Module } from '@nestjs/common';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';
import { S3Service } from '../../common/services/s3.service';
import { EmailService } from '../auth/services/email.service';

@Module({
  controllers: [KycController],
  providers: [KycService, S3Service, EmailService],
  exports: [KycService],
})
export class KycModule {}
