import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import configuration from '../config/configuration';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { WalletsModule } from './modules/wallets/wallets.module';
import { ProductsModule } from './modules/products/products.module';
import { OrdersModule } from './modules/orders/orders.module';
import { KycModule } from './modules/kyc/kyc.module';
import { FiatPurchaseModule } from './modules/fiat-purchase/fiat-purchase.module';
import { DepositMonitorModule } from './modules/deposit-monitor/deposit-monitor.module';
import { WithdrawalProcessorModule } from './modules/withdrawal-processor/withdrawal-processor.module';
import { ApiKeysModule } from './modules/api-keys/api-keys.module';
import { AdsModule } from './modules/ads/ads.module';
import { ExternalPaymentModule } from './modules/external-payment/external-payment.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { CommissionsModule } from './modules/commissions/commissions.module';
import { SellersModule } from './modules/sellers/sellers.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { SmartContractModule } from './modules/smart-contract/smart-contract.module';
import { MerchantModule } from './modules/merchant/merchant.module';
import { AdminManagementModule } from './modules/admin-management/admin-management.module';
import { MerchantManagementModule } from './modules/merchant-management/merchant-management.module';
import { MerchantOnboardingModule } from './modules/merchant-onboarding/merchant-onboarding.module';
import { AddressesModule } from './modules/addresses/addresses.module';
import { UserManagementModule } from './modules/user-management/user-management.module';
import { RewardsModule } from './modules/rewards/rewards.module';
import { NetworksModule } from './modules/networks/networks.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '.env',
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 10,
      },
    ]),
    PrismaModule,
    CommonModule,
    AuthModule,
    UsersModule,
    WalletsModule,
    ProductsModule,
    OrdersModule,
    KycModule,
    FiatPurchaseModule,
    DepositMonitorModule,
    WithdrawalProcessorModule,
    ApiKeysModule,
    // New modules for external API integration
    AdsModule,
    ExternalPaymentModule,
    WebhooksModule,
    CommissionsModule,
    SellersModule,
    FavoritesModule,
    // Smart contract blockchain integration
    SmartContractModule,
    MerchantModule,
    AdminManagementModule,
    MerchantManagementModule,
    MerchantOnboardingModule,
    AddressesModule,
    // User management and rewards
    UserManagementModule,
    RewardsModule,
    // Network configuration management
    NetworksModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
