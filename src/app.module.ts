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
import { CsrfGuard } from './common/guards/csrf.guard';
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
import { SupportModule } from './modules/support/support.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { UploadModule } from './modules/upload/upload.module';
import { SettingsModule } from './modules/settings/settings.module';
import { TonPaymentModule } from './modules/ton-payment/ton-payment.module';
import { AIInfrastructureModule } from './modules/ai-infrastructure/ai-infrastructure.module';
import { AIChatModule } from './modules/ai-chat/ai-chat.module';
import { OxlienModule } from './modules/oxlien/oxlien.module';
import { IoTModule } from './modules/iot/iot.module';
import { RedisModule } from './modules/redis/redis.module';
import { SecretsModule } from './modules/secrets/secrets.module';
import { ShopifyModule } from './modules/shopify/shopify.module';
import { MerchantWalletModule } from './modules/merchant-wallet/merchant-wallet.module';
import { SettlementModule } from './modules/settlement/settlement.module';
import { AccountingModule } from './modules/accounting/accounting.module';
import { FinancialReportsModule } from './modules/financial-reports/financial-reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '.env',
    }),
    RedisModule,
    SecretsModule,
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
    // Merchant wallet and settlement
    MerchantWalletModule,
    SettlementModule,
    // Accounting and ledger system
    AccountingModule,
    FinancialReportsModule,
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
    // Support and help functionality
    SupportModule,
    // Product reviews
    ReviewsModule,
    // File upload to S3
    UploadModule,
    // System settings
    SettingsModule,
    // TON blockchain payment
    TonPaymentModule,
    // AI Features - Oxlien Shopping Assistant
    AIInfrastructureModule,
    AIChatModule,
    OxlienModule,
    IoTModule,
    // Shopify Integration
    ShopifyModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
  ],
})
export class AppModule {}
