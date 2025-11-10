import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import axios from 'axios';
import { Decimal } from '@prisma/client/runtime/library';
import { StablecoinType } from '@prisma/client';

@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);
  private rateCache = new Map<string, { rate: Decimal; validUntil: Date }>();

  constructor(private prisma: PrismaService) {}

  async getExchangeRate(
    stablecoinType: StablecoinType,
    fiatCurrency: string,
  ): Promise<Decimal> {
    const cacheKey = `${stablecoinType}_${fiatCurrency}`;
    const cached = this.rateCache.get(cacheKey);

    // Check cache (valid for 5 minutes)
    if (cached && cached.validUntil > new Date()) {
      return cached.rate;
    }

    // Try to get from database
    const dbRate = await this.prisma.exchangeRate.findUnique({
      where: {
        stablecoinType_fiatCurrency: {
          stablecoinType,
          fiatCurrency,
        },
      },
    });

    if (dbRate && dbRate.validUntil > new Date()) {
      const rate = new Decimal(dbRate.rate.toString());
      this.rateCache.set(cacheKey, { rate, validUntil: dbRate.validUntil });
      return rate;
    }

    // Fetch fresh rate
    const rate = await this.fetchExchangeRate(stablecoinType, fiatCurrency);

    // Save to database
    const validUntil = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    await this.prisma.exchangeRate.upsert({
      where: {
        stablecoinType_fiatCurrency: {
          stablecoinType,
          fiatCurrency,
        },
      },
      create: {
        stablecoinType,
        fiatCurrency,
        rate,
        provider: 'coinbase',
        validUntil,
      },
      update: {
        rate,
        validUntil,
      },
    });

    this.rateCache.set(cacheKey, { rate, validUntil });
    return rate;
  }

  private async fetchExchangeRate(
    stablecoinType: StablecoinType,
    fiatCurrency: string,
  ): Promise<Decimal> {
    try {
      // For stablecoins, rate is generally 1:1 with USD
      // But we'll add a small spread for business margin (0.5%)
      if (fiatCurrency === 'USD') {
        return new Decimal('1.005'); // $1.005 per stablecoin
      }

      // For other currencies, fetch real-time rates
      if (fiatCurrency === 'INR') {
        // Fetch USD to INR rate
        const response = await axios.get(
          'https://api.exchangerate-api.com/v4/latest/USD',
        );
        const usdToInr = response.data.rates.INR;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        return new Decimal(usdToInr).mul('1.005'); // Add 0.5% spread
      }

      // Default to 1:1
      return new Decimal('1.005');
    } catch (error) {
      this.logger.error(`Failed to fetch exchange rate: ${error.message}`);
      // Fallback rates
      if (fiatCurrency === 'USD') return new Decimal('1.005');
      if (fiatCurrency === 'INR') return new Decimal('83.5'); // Approximate
      return new Decimal('1.005');
    }
  }

  calculateStablecoinAmount(
    fiatAmount: number,
    exchangeRate: Decimal,
    fee: Decimal,
  ): Decimal {
    const fiatDecimal = new Decimal(fiatAmount);
    const netAmount = fiatDecimal.sub(fee);
    return netAmount.div(exchangeRate);
  }

  calculateProcessingFee(amount: number, provider: string): Decimal {
    // Stripe: 2.9% + $0.30
    if (provider === 'STRIPE') {
      return new Decimal(amount).mul('0.029').add('0.30');
    }

    // Razorpay: 2% (in India)
    if (provider === 'RAZORPAY') {
      return new Decimal(amount).mul('0.02');
    }

    return new Decimal('0');
  }
}
