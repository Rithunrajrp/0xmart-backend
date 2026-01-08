import { Module, forwardRef } from '@nestjs/common';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';
import { AddressGeneratorService } from './services/address-generator.service';
import { BlockchainService } from './services/blockchain.service';
import { DepositMonitorModule } from '../deposit-monitor/deposit-monitor.module';

@Module({
  imports: [forwardRef(() => DepositMonitorModule)],
  controllers: [WalletsController],
  providers: [WalletsService, AddressGeneratorService, BlockchainService],
  exports: [WalletsService, BlockchainService, AddressGeneratorService],
})
export class WalletsModule {}
