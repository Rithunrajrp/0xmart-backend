import { Module, forwardRef } from '@nestjs/common';
import { ExternalPaymentController } from './external-payment.controller';
import { ExternalPaymentService } from './external-payment.service';
import { PrismaModule } from '../../../prisma/prisma.module';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { AdsModule } from '../ads/ads.module';
import { CommissionsModule } from '../commissions/commissions.module';
import { SellersModule } from '../sellers/sellers.module';
import { AuthModule } from '../auth/auth.module';
import { WalletsModule } from '../wallets/wallets.module';
import { SmartContractModule } from '../smart-contract/smart-contract.module';
import { NetworksModule } from '../networks/networks.module';

@Module({
  imports: [
    PrismaModule,
    ApiKeysModule,
    AdsModule,
    forwardRef(() => CommissionsModule),
    SellersModule,
    AuthModule,
    WalletsModule,
    SmartContractModule,
    NetworksModule,
  ],
  controllers: [ExternalPaymentController],
  providers: [ExternalPaymentService],
  exports: [ExternalPaymentService],
})
export class ExternalPaymentModule {}
