import { Module } from '@nestjs/common';
import { WithdrawalProcessorController } from './withdrawal-processor.controller';
import { WithdrawalProcessorService } from './withdrawal-processor.service';
import { WalletsModule } from '../wallets/wallets.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [WalletsModule, AuthModule, WalletsModule],
  controllers: [WithdrawalProcessorController],
  providers: [WithdrawalProcessorService],
  exports: [WithdrawalProcessorService],
})
export class WithdrawalProcessorModule {}
