import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../prisma/prisma.service';
import { SmartContractService } from './smart-contract.service';
import { NetworkType, TransactionStatus, OrderStatus } from '@prisma/client';
import { ethers } from 'ethers';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Blockchain Event Listener Service
 *
 * Listens to PaymentReceived events from smart contracts and updates database
 */
@Injectable()
export class BlockchainEventListenerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(BlockchainEventListenerService.name);
  private readonly listeners: Map<NetworkType, any> = new Map();
  private pollingIntervals: NodeJS.Timeout[] = [];

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly contractService: SmartContractService,
  ) {}

  async onModuleInit() {
    if (process.env.NODE_ENV !== 'test') {
      this.logger.log('Starting blockchain event listeners...');
      await this.startListeners();
    }
  }

  onModuleDestroy() {
    this.logger.log('Stopping blockchain event listeners...');
    this.stopListeners();
  }

  private async startListeners() {
    await this.startEVMListeners();
    this.startFallbackPolling();
  }

  private async startEVMListeners() {
    const evmNetworks = [
      NetworkType.ETHEREUM,
      NetworkType.POLYGON,
      NetworkType.BSC,
      NetworkType.ARBITRUM,
      NetworkType.OPTIMISM,
      NetworkType.AVALANCHE,
      NetworkType.BASE,
    ];

    for (const network of evmNetworks) {
      try {
        const contract = this.contractService.getContract(network);
        if (!contract) {
          this.logger.warn(`Contract not initialized for ${network}`);
          continue;
        }

        const filter = contract.filters.PaymentReceived();
        const listener = async (...args: any[]) => {
          const event = args[args.length - 1];
          await this.handlePaymentReceivedEvent(network, event);
        };

        contract.on(filter, listener);
        this.listeners.set(network, { contract, filter, listener });
        this.logger.log(`Started event listener for ${network}`);
      } catch (error) {
        this.logger.error(`Failed to start listener for ${network}`, error);
      }
    }
  }

  private async handlePaymentReceivedEvent(network: NetworkType, event: any) {
    try {
      this.logger.log(
        `PaymentReceived event on ${network}: ${event.transactionHash}`,
      );

      const orderId = event.args.orderId;
      const receipt = await this.contractService.getTransactionReceipt(
        network,
        event.transactionHash,
      );

      if (!receipt) {
        this.logger.error(`Failed to get receipt for ${event.transactionHash}`);
        return;
      }

      let transaction = await this.prisma.transaction.findUnique({
        where: { txHash: event.transactionHash },
      });

      if (transaction) {
        transaction = await this.prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            status: TransactionStatus.COMPLETED,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed,
            confirmations: receipt.confirmations,
            platformFee: new Decimal(
              ethers.utils.formatUnits(event.args.platformFee.toString(), 8),
            ),
            apiCommission: new Decimal(
              ethers.utils.formatUnits(event.args.commission.toString(), 8),
            ),
            completedAt: new Date(),
          },
        });
      }

      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.PAID,
          paidAt: new Date(),
        },
      });

      if (transaction?.apiKeyId && Number(event.args.commissionBps) > 0) {
        await this.updateApiKeyEarnings(
          transaction.apiKeyId,
          new Decimal(
            ethers.utils.formatUnits(event.args.commission.toString(), 8),
          ),
        );
      }

      this.logger.log(`Successfully processed payment for order ${orderId}`);
    } catch (error) {
      this.logger.error(`Failed to handle PaymentReceived event`, error);
    }
  }

  private async updateApiKeyEarnings(apiKeyId: string, commission: Decimal) {
    try {
      await this.prisma.apiKey.update({
        where: { id: apiKeyId },
        data: {
          totalEarnings: { increment: commission },
          pendingEarnings: { increment: commission },
        },
      });
    } catch (error) {
      this.logger.error(`Failed to update API key earnings`, error);
    }
  }

  private startFallbackPolling() {
    const fallbackInterval = setInterval(
      async () => {
        await this.pollMissedEvents();
      },
      5 * 60 * 1000,
    );

    this.pollingIntervals.push(fallbackInterval);
  }

  private async pollMissedEvents() {
    try {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

      const pendingTxs = await this.prisma.transaction.findMany({
        where: {
          status: TransactionStatus.PENDING,
          txHash: { not: null },
          network: {
            in: [
              NetworkType.ETHEREUM,
              NetworkType.POLYGON,
              NetworkType.BSC,
              NetworkType.ARBITRUM,
              NetworkType.OPTIMISM,
              NetworkType.AVALANCHE,
              NetworkType.BASE,
            ],
          },
          createdAt: { lt: twoMinutesAgo },
        },
        take: 20,
      });

      for (const tx of pendingTxs) {
        if (!tx.network || !tx.txHash) continue;

        try {
          const receipt = await this.contractService.getTransactionReceipt(
            tx.network,
            tx.txHash,
          );

          if (!receipt) continue;

          if (receipt.status === 'failed') {
            await this.prisma.transaction.update({
              where: { id: tx.id },
              data: {
                status: TransactionStatus.FAILED,
                failureReason: 'Transaction reverted on-chain',
              },
            });
            continue;
          }

          const eventData =
            await this.contractService.getPaymentEventFromReceipt(
              tx.network,
              tx.txHash,
            );

          if (!eventData) continue;

          await this.prisma.transaction.update({
            where: { id: tx.id },
            data: {
              status: TransactionStatus.COMPLETED,
              blockNumber: receipt.blockNumber,
              gasUsed: receipt.gasUsed,
              confirmations: receipt.confirmations,
              platformFee: new Decimal(
                ethers.utils.formatUnits(eventData.platformFee, 8),
              ),
              apiCommission: new Decimal(
                ethers.utils.formatUnits(eventData.commission, 8),
              ),
              completedAt: new Date(),
            },
          });

          if (tx.orderId) {
            await this.prisma.order.update({
              where: { id: tx.orderId },
              data: {
                status: OrderStatus.PAID,
                paidAt: new Date(),
              },
            });
          }

          if (tx.apiKeyId && eventData.commissionBps > 0) {
            await this.updateApiKeyEarnings(
              tx.apiKeyId,
              new Decimal(ethers.utils.formatUnits(eventData.commission, 8)),
            );
          }
        } catch (error) {
          this.logger.error(
            `Failed to process pending transaction ${tx.txHash}`,
            error,
          );
        }
      }
    } catch (error) {
      this.logger.error('Failed to poll missed events', error);
    }
  }

  private stopListeners() {
    for (const [network, listenerData] of this.listeners.entries()) {
      try {
        const { contract, filter, listener } = listenerData;
        contract.off(filter, listener);
      } catch (error) {
        this.logger.error(`Failed to stop listener for ${network}`, error);
      }
    }
    this.listeners.clear();

    for (const interval of this.pollingIntervals) {
      clearInterval(interval);
    }
    this.pollingIntervals = [];
  }
}
