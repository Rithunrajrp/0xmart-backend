import { Module } from '@nestjs/common';
import { TonPaymentController } from './ton-payment.controller';
import { TonPaymentService } from './ton-payment.service';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TonPaymentController],
  providers: [TonPaymentService],
  exports: [TonPaymentService],
})
export class TonPaymentModule {}
