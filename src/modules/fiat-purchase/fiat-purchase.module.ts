import { Module } from '@nestjs/common';
import { FiatPurchaseController } from './fiat-purchase.controller';
import { FiatPurchaseService } from './fiat-purchase.service';
import { ExchangeRateService } from './services/exchange-rate.service';
import { StripeService } from './services/stripe.service';
import { RazorpayService } from './services/razorpay.service';
import { WalletsModule } from '../wallets/wallets.module';

@Module({
  imports: [WalletsModule],
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
