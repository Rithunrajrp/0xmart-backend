import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import configuration from '../config/configuration';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { WalletsModule } from './modules/wallets/wallets.module';
import { ProductsModule } from './modules/products/products.module';
import { OrdersModule } from './modules/orders/orders.module';
import { KycModule } from './modules/kyc/kyc.module';
import { FiatPurchaseModule } from './modules/fiat-purchase/fiat-purchase.module';
import { DepositMonitorModule } from './modules/deposit-monitor/deposit-monitor.module';
import { WithdrawalProcessorModule } from './modules/withdrawal-processor/withdrawal-processor.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';

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
    AuthModule,
    UsersModule,
    WalletsModule,
    ProductsModule,
    OrdersModule,
    KycModule,
    FiatPurchaseModule,
    DepositMonitorModule,
    WithdrawalProcessorModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
