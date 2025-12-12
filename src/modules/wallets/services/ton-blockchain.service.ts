import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NetworkType } from '@prisma/client';

/**
 * TON Blockchain Service
 * Handles interactions with TON blockchain
 *
 * TON uses a different architecture than EVM chains:
 * - Account-based model (not UTXO)
 * - Asynchronous message passing between contracts
 * - Multi-chain architecture (workchains and shardchains)
 * - Native wallet contracts (v3, v4, highload)
 */

interface TonTransaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  fee: string;
  timestamp: number;
  confirmed: boolean;
}

interface TonBalance {
  balance: string;
  decimals: number;
}

@Injectable()
export class TonBlockchainService {
  private readonly logger = new Logger(TonBlockchainService.name);
  private tonRpcUrl: string;
  private tonApiKey: string;

  constructor(private configService: ConfigService) {
    this.tonRpcUrl =
      this.configService.get<string>('blockchain.ton') ||
      'https://toncenter.com/api/v2/jsonRPC';
    this.tonApiKey =
      this.configService.get<string>('blockchain.tonApiKey') || '';

    if (this.tonRpcUrl) {
      this.logger.log(`✅ TON provider initialized: ${this.tonRpcUrl}`);
    } else {
      this.logger.warn('⚠️ TON RPC URL not configured');
    }
  }

  /**
   * Check if TON is configured
   */
  isConfigured(): boolean {
    return !!this.tonRpcUrl;
  }

  /**
   * Get TON balance for an address
   * @param address TON address (user-friendly or raw format)
   * @returns Balance in TON (nanotons / 10^9)
   */
  async getBalance(address: string): Promise<string> {
    try {
      const response = await fetch(this.tonRpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.tonApiKey,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getAddressBalance',
          params: {
            address,
          },
        }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message);
      }

      // Convert nanotons to TON
      const nanotons = BigInt(data.result || '0');
      const tons = Number(nanotons) / 1e9;
      return tons.toString();
    } catch (error) {
      this.logger.error(
        `Failed to get TON balance for ${address}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Get jetton (TON token) balance
   * @param jettonMasterAddress Jetton master contract address
   * @param walletAddress User's wallet address
   * @returns Balance with decimals
   */
  async getJettonBalance(
    jettonMasterAddress: string,
    walletAddress: string,
  ): Promise<TonBalance> {
    try {
      // First, get the jetton wallet address for this user
      const jettonWalletAddress = await this.getJettonWalletAddress(
        jettonMasterAddress,
        walletAddress,
      );

      // Then query the balance from the jetton wallet
      const response = await fetch(this.tonRpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.tonApiKey,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'runGetMethod',
          params: {
            address: jettonWalletAddress,
            method: 'get_wallet_data',
            stack: [],
          },
        }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message);
      }

      // Parse balance from stack (first element is balance)
      const balance = data.result?.stack?.[0]?.value || '0';

      return {
        balance,
        decimals: 6, // Most stablecoins use 6 decimals
      };
    } catch (error) {
      this.logger.error(`Failed to get jetton balance: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get jetton wallet address for a user
   * Each user has a unique jetton wallet contract for each jetton type
   */
  private async getJettonWalletAddress(
    jettonMasterAddress: string,
    ownerAddress: string,
  ): Promise<string> {
    try {
      const response = await fetch(this.tonRpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.tonApiKey,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'runGetMethod',
          params: {
            address: jettonMasterAddress,
            method: 'get_wallet_address',
            stack: [
              {
                type: 'slice',
                value: ownerAddress,
              },
            ],
          },
        }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message);
      }

      return data.result?.stack?.[0]?.value || '';
    } catch (error) {
      this.logger.error(
        `Failed to get jetton wallet address: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Get transaction details by hash
   */
  async getTransaction(txHash: string): Promise<TonTransaction | null> {
    try {
      const response = await fetch(this.tonRpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.tonApiKey,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getTransactions',
          params: {
            address: '', // Will need to be provided
            limit: 1,
            hash: txHash,
          },
        }),
      });

      const data = await response.json();

      if (data.error || !data.result || data.result.length === 0) {
        return null;
      }

      const tx = data.result[0];

      return {
        hash: tx.transaction_id?.hash || txHash,
        from: tx.in_msg?.source || '',
        to: tx.in_msg?.destination || '',
        value: tx.in_msg?.value || '0',
        fee: tx.fee || '0',
        timestamp: tx.utime || 0,
        confirmed: true, // TON has fast finality
      };
    } catch (error) {
      this.logger.error(
        `Failed to get transaction ${txHash}: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Get recent transactions for an address
   */
  async getTransactions(
    address: string,
    limit = 10,
  ): Promise<TonTransaction[]> {
    try {
      const response = await fetch(this.tonRpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.tonApiKey,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getTransactions',
          params: {
            address,
            limit,
          },
        }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message);
      }

      return (data.result || []).map((tx: any) => ({
        hash: tx.transaction_id?.hash || '',
        from: tx.in_msg?.source || '',
        to: tx.in_msg?.destination || '',
        value: tx.in_msg?.value || '0',
        fee: tx.fee || '0',
        timestamp: tx.utime || 0,
        confirmed: true,
      }));
    } catch (error) {
      this.logger.error(
        `Failed to get transactions for ${address}: ${error.message}`,
      );
      return [];
    }
  }

  /**
   * Monitor address for incoming transactions
   * Note: TON requires polling or webhook setup via TON API
   */
  async monitorAddress(
    address: string,
    callback: (tx: TonTransaction) => void,
  ): Promise<void> {
    this.logger.log(`Monitoring TON address: ${address}`);

    // Note: Actual implementation would use TON API webhooks or polling
    // For now, this is a placeholder for the monitoring logic

    // In production, you would:
    // 1. Use TON Center API webhooks
    // 2. Or implement polling with getTransactions
    // 3. Store last processed transaction hash
    // 4. Check for new transactions periodically
  }

  /**
   * Validate TON address format
   */
  isValidAddress(address: string): boolean {
    try {
      // TON addresses can be:
      // 1. User-friendly: 48 characters base64url (EQ...)
      // 2. Raw: 64 hex characters
      // 3. Bounceable/non-bounceable variants

      const userFriendlyRegex = /^[Ee][Qq][A-Za-z0-9_-]{46}$/;
      const rawAddressRegex = /^[A-Fa-f0-9]{64}$/;

      return userFriendlyRegex.test(address) || rawAddressRegex.test(address);
    } catch {
      return false;
    }
  }

  /**
   * Get current block height
   */
  async getCurrentBlock(): Promise<number> {
    try {
      const response = await fetch(this.tonRpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.tonApiKey,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getMasterchainInfo',
          params: {},
        }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message);
      }

      return data.result?.last?.seqno || 0;
    } catch (error) {
      this.logger.error(`Failed to get current block: ${error.message}`);
      return 0;
    }
  }
}
