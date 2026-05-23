import { Module } from '@nestjs/common';
import { MerchantWalletController } from './merchant-wallet.controller';
import { MerchantWalletService } from './merchant-wallet.service';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MerchantWalletController],
  providers: [MerchantWalletService],
  exports: [MerchantWalletService],
})
export class MerchantWalletModule {}
