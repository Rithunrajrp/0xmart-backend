import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../../prisma/prisma.module';
import { EvmListenerService } from './services/evm-listener.service';
import { SolanaListenerService } from './services/solana-listener.service';
import { ContractPaymentService } from './services/contract-payment.service';
import { SmartContractService } from './services/smart-contract.service';
import { BlockchainEventListenerService } from './services/blockchain-event-listener.service';
import { SmartContractController } from './smart-contract.controller';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [SmartContractController],
  providers: [
    SmartContractService,
    BlockchainEventListenerService,
    EvmListenerService,
    SolanaListenerService,
    ContractPaymentService,
  ],
  exports: [
    SmartContractService,
    BlockchainEventListenerService,
    EvmListenerService,
    SolanaListenerService,
    ContractPaymentService,
  ],
})
export class SmartContractModule {}
