import { Module } from '@nestjs/common';
import { FiatPurchaseController } from './fiat-purchase.controller';
import { FiatPurchaseService } from './fiat-purchase.service';
import { ExchangeRateService } from './services/exchange-rate.service';
import { StripeService } from './services/stripe.service';
import { RazorpayService } from './services/razorpay.service';
import { WalletsModule } from '../wallets/wallets.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [WalletsModule, AuthModule],
  controllers: [FiatPurchaseController],
  providers: [
    FiatPurchaseService,
    ExchangeRateService,
    StripeService,
    RazorpayService,
  ],
  exports: [FiatPurchaseService],
})
export class FiatPurchaseModule {}
