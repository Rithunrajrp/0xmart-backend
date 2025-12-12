import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SuiClient } from '@mysten/sui/client';

/**
 * SUI Blockchain Service
 * Handles interactions with SUI blockchain
 *
 * SUI Architecture:
 * - High-performance blockchain with parallel execution
 * - Object-centric model (everything is an object)
 * - Move language for smart contracts
 * - Fast finality (~400ms)
 * - Low transaction fees
 * - Native Coin standard
 */

interface SuiTransaction {
  digest: string;
  timestampMs: number;
  checkpoint: string;
  effects: {
    status: { status: string };
  };
}

interface CoinBalance {
  coinType: string;
  coinObjectCount: number;
  totalBalance: string;
  lockedBalance: Record<string, string>;
}

@Injectable()
export class SuiBlockchainService {
  private readonly logger = new Logger(SuiBlockchainService.name);
  private client: SuiClient | null = null;
  private rpcUrl: string;

  constructor(private configService: ConfigService) {
    this.rpcUrl = this.configService.get<string>('blockchain.sui') || '';

    if (this.rpcUrl) {
      this.initializeClient();
    } else {
      this.logger.warn('⚠️ SUI RPC URL not configured');
    }
  }

  /**
   * Initialize SUI client
   */
  private initializeClient() {
    try {
      this.client = new SuiClient({ url: this.rpcUrl });
      this.logger.log(`✅ SUI client initialized: ${this.rpcUrl}`);
    } catch (error) {
      this.logger.error(`Failed to initialize SUI client: ${error.message}`);
      this.client = null;
    }
  }

  /**
   * Check if SUI is configured
   */
  isConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * Get client instance
   */
  getClient(): SuiClient {
    if (!this.client) {
      throw new Error('SUI client not configured');
    }
    return this.client;
  }

  /**
   * Get SUI balance for an address
   * @param address SUI wallet address (0x...)
   * @returns Balance in SUI
   */
  async getBalance(address: string): Promise<string> {
    try {
      const client = this.getClient();
      const balance = await client.getBalance({
        owner: address,
      });

      // Convert MIST to SUI (1 SUI = 10^9 MIST)
      const sui = Number(balance.totalBalance) / 1e9;
      return sui.toString();
    } catch (error) {
      this.logger.error(
        `Failed to get SUI balance for ${address}: ${error.message}`,
      );
      return '0';
    }
  }

  /**
   * Get coin balance for a specific coin type
   * @param address SUI wallet address
   * @param coinType Coin type (e.g., "0x2::sui::SUI" or custom coin)
   * @returns Balance object with details
   */
  async getCoinBalance(
    address: string,
    coinType: string,
  ): Promise<CoinBalance> {
    try {
      const client = this.getClient();
      const balance = await client.getBalance({
        owner: address,
        coinType: coinType,
      });

      return {
        coinType: balance.coinType,
        coinObjectCount: balance.coinObjectCount,
        totalBalance: balance.totalBalance,
        lockedBalance: balance.lockedBalance || {},
      };
    } catch (error) {
      this.logger.error(
        `Failed to get coin balance for ${address} (${coinType}): ${error.message}`,
      );
      return {
        coinType,
        coinObjectCount: 0,
        totalBalance: '0',
        lockedBalance: {},
      };
    }
  }

  /**
   * Get all coin balances for an address
   * @param address SUI wallet address
   * @returns Array of all coin balances
   */
  async getAllBalances(address: string): Promise<CoinBalance[]> {
    try {
      const client = this.getClient();
      const balances = await client.getAllBalances({ owner: address });
      return balances;
    } catch (error) {
      this.logger.error(
        `Failed to get all balances for ${address}: ${error.message}`,
      );
      return [];
    }
  }

  /**
   * Get transactions for an address
   * @param address SUI wallet address
   * @param cursor Optional cursor for pagination
   * @param limit Maximum number of transactions to fetch
   * @returns Array of transaction digests and cursor for next page
   */
  async getTransactionsForAddress(
    address: string,
    cursor?: string | null,
    limit: number = 50,
  ): Promise<{
    data: string[];
    nextCursor: string | null;
    hasNextPage: boolean;
  }> {
    try {
      const client = this.getClient();
      const txns = await client.queryTransactionBlocks({
        filter: {
          ToAddress: address,
        },
        cursor: cursor,
        limit: limit,
        options: {
          showInput: true,
          showEffects: true,
          showEvents: true,
        },
      });

      return {
        data: txns.data.map((tx) => tx.digest),
        nextCursor: txns.nextCursor || null,
        hasNextPage: txns.hasNextPage,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get transactions for ${address}: ${error.message}`,
      );
      return { data: [], nextCursor: null, hasNextPage: false };
    }
  }

  /**
   * Get transaction details
   * @param digest Transaction digest
   * @returns Transaction details
   */
  async getTransaction(digest: string): Promise<any | null> {
    try {
      const client = this.getClient();
      const tx = await client.getTransactionBlock({
        digest: digest,
        options: {
          showInput: true,
          showEffects: true,
          showEvents: true,
          showObjectChanges: true,
          showBalanceChanges: true,
        },
      });

      return tx;
    } catch (error) {
      this.logger.error(
        `Failed to get transaction ${digest}: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Parse coin transfer from transaction
   * @param digest Transaction digest
   * @returns Transfer details or null
   */
  async parseCoinTransfer(digest: string): Promise<{
    from: string;
    to: string;
    amount: string;
    coinType: string;
  } | null> {
    try {
      const tx = await this.getTransaction(digest);
      if (!tx) return null;

      // Look for balance changes to identify transfers
      const balanceChanges = tx.balanceChanges || [];

      if (balanceChanges.length >= 2) {
        // Find the sender (negative balance change)
        const sender = balanceChanges.find((bc) => BigInt(bc.amount) < 0);
        // Find the recipient (positive balance change)
        const recipient = balanceChanges.find((bc) => BigInt(bc.amount) > 0);

        if (sender && recipient && sender.coinType === recipient.coinType) {
          return {
            from: sender.owner.AddressOwner || sender.owner,
            to: recipient.owner.AddressOwner || recipient.owner,
            amount: recipient.amount,
            coinType: recipient.coinType,
          };
        }
      }

      return null;
    } catch (error) {
      this.logger.error(
        `Failed to parse coin transfer ${digest}: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Validate SUI address format
   * @param address Address to validate
   * @returns True if valid
   */
  isValidAddress(address: string): boolean {
    // SUI addresses are 32-byte hex strings with 0x prefix (66 chars total)
    const suiAddressRegex = /^0x[a-fA-F0-9]{64}$/;
    return suiAddressRegex.test(address);
  }

  /**
   * Get current epoch
   * @returns Current epoch number
   */
  async getCurrentEpoch(): Promise<string> {
    try {
      const client = this.getClient();
      const epoch = await client.getLatestSuiSystemState();
      return epoch.epoch;
    } catch (error) {
      this.logger.error(`Failed to get current epoch: ${error.message}`);
      return '0';
    }
  }

  /**
   * Get coin metadata (decimals, symbol, name)
   * @param coinType Coin type identifier
   * @returns Coin metadata
   */
  async getCoinMetadata(coinType: string): Promise<{
    decimals: number;
    name: string;
    symbol: string;
    description: string;
  } | null> {
    try {
      const client = this.getClient();
      const metadata = await client.getCoinMetadata({ coinType });

      if (!metadata) return null;

      return {
        decimals: metadata.decimals,
        name: metadata.name,
        symbol: metadata.symbol,
        description: metadata.description,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get coin metadata for ${coinType}: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Get reference gas price
   * @returns Gas price in MIST
   */
  async getReferenceGasPrice(): Promise<string> {
    try {
      const client = this.getClient();
      const gasPrice = await client.getReferenceGasPrice();
      return gasPrice.toString();
    } catch (error) {
      this.logger.error(`Failed to get reference gas price: ${error.message}`);
      return '1000'; // Default fallback
    }
  }
}
