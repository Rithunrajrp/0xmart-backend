import { Module } from '@nestjs/common';
import {
  MerchantSettlementController,
  AdminSettlementController,
} from './settlement.controller';
import { SettlementService } from './settlement.service';
import { PrismaModule } from '../../../prisma/prisma.module';
import { MerchantWalletModule } from '../merchant-wallet/merchant-wallet.module';

@Module({
  imports: [PrismaModule, MerchantWalletModule],
  controllers: [MerchantSettlementController, AdminSettlementController],
  providers: [SettlementService],
  exports: [SettlementService],
})
export class SettlementModule {}
