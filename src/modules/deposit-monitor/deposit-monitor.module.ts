import { Module } from '@nestjs/common';
import { DepositMonitorService } from './deposit-monitor.service';
import { DepositMonitorController } from './deposit-monitor.controller';
import { WalletsModule } from '../wallets/wallets.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [WalletsModule, AuthModule],
  controllers: [DepositMonitorController],
  providers: [DepositMonitorService],
  exports: [DepositMonitorService],
})
export class DepositMonitorModule {}
