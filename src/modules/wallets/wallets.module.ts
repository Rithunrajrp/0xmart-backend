import { Module } from '@nestjs/common';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';
import { AddressGeneratorService } from './services/address-generator.service';
import { BlockchainService } from './services/blockchain.service';

@Module({
  controllers: [WalletsController],
  providers: [WalletsService, AddressGeneratorService, BlockchainService],
  exports: [WalletsService, BlockchainService, AddressGeneratorService],
})
export class WalletsModule {}
