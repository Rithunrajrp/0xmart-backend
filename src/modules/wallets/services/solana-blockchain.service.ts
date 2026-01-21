import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  ParsedAccountData,
  ConfirmedSignatureInfo,
  Keypair,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  getAccount,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { NetworkType } from '@prisma/client';

/**
 * Solana Blockchain Service
 * Handles interactions with Solana blockchain
 *
 * Solana Architecture:
 * - High-performance blockchain (50k+ TPS)
 * - Account-based model
 * - SPL Token standard (similar to ERC20)
 * - Fast finality (~400ms)
 * - Low transaction fees
 */

interface SolanaTransaction {
  signature: string;
  blockTime: number;
  slot: number;
  confirmationStatus: string;
  from?: string;
  to?: string;
  amount?: string;
  fee: number;
}

interface TokenBalance {
  balance: string;
  decimals: number;
  uiAmount: number;
}

@Injectable()
export class SolanaBlockchainService {
  private readonly logger = new Logger(SolanaBlockchainService.name);
  private connection: Connection | null = null;
  private rpcUrl: string;

  constructor(private configService: ConfigService) {
    this.rpcUrl = this.configService.get<string>('blockchain.solana') || '';

    if (this.rpcUrl) {
      this.initializeConnection();
    } else {
      this.logger.warn('⚠️ Solana RPC URL not configured');
    }
  }

  /**
   * Initialize Solana connection
   */
  private initializeConnection() {
    try {
      this.connection = new Connection(this.rpcUrl, 'confirmed');
      this.logger.log(`✅ Solana provider initialized: ${this.rpcUrl}`);
    } catch (error) {
      this.logger.error(
        `Failed to initialize Solana connection: ${error.message}`,
      );
      this.connection = null;
    }
  }

  /**
   * Check if Solana is configured
   */
  isConfigured(): boolean {
    return this.connection !== null;
  }

  /**
   * Get connection instance
   */
  getConnection(): Connection {
    if (!this.connection) {
      throw new Error('Solana connection not configured');
    }
    return this.connection;
  }

  /**
   * Get SOL balance for an address
   * @param address Solana wallet address (base58)
   * @returns Balance in SOL
   */
  async getBalance(address: string): Promise<string> {
    try {
      const connection = this.getConnection();
      const publicKey = new PublicKey(address);
      const balance = await connection.getBalance(publicKey);

      // Convert lamports to SOL
      const sol = balance / LAMPORTS_PER_SOL;
      return sol.toString();
    } catch (error) {
      this.logger.error(
        `Failed to get SOL balance for ${address}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Get SPL token balance
   * @param tokenMintAddress Token mint address (e.g., USDC mint)
   * @param walletAddress User's wallet address
   * @returns Token balance with decimals
   */
  async getTokenBalance(
    tokenMintAddress: string,
    walletAddress: string,
  ): Promise<TokenBalance> {
    try {
      const connection = this.getConnection();
      const walletPublicKey = new PublicKey(walletAddress);
      const tokenMintPublicKey = new PublicKey(tokenMintAddress);

      // Get token accounts owned by this wallet
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        walletPublicKey,
        {
          mint: tokenMintPublicKey,
        },
      );

      if (tokenAccounts.value.length === 0) {
        return {
          balance: '0',
          decimals: 6,
          uiAmount: 0,
        };
      }

      // Get the first (usually only) token account
      const tokenAccount = tokenAccounts.value[0];
      const parsedData = tokenAccount.account.data;
      const tokenAmount = parsedData.parsed.info.tokenAmount;

      return {
        balance: tokenAmount.amount,
        decimals: tokenAmount.decimals,
        uiAmount: tokenAmount.uiAmount || 0,
      };
    } catch (error) {
      this.logger.error(`Failed to get token balance: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get transaction details by signature
   */
  async getTransaction(signature: string): Promise<SolanaTransaction | null> {
    try {
      const connection = this.getConnection();
      const transaction = await connection.getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0,
      });

      if (!transaction) {
        return null;
      }

      return {
        signature,
        blockTime: transaction.blockTime || 0,
        slot: transaction.slot,
        confirmationStatus: transaction.meta?.err ? 'failed' : 'confirmed',
        fee: transaction.meta?.fee || 0,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get transaction ${signature}: ${error.message}`,
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
  ): Promise<SolanaTransaction[]> {
    try {
      const connection = this.getConnection();
      const publicKey = new PublicKey(address);

      const signatures = await connection.getSignaturesForAddress(publicKey, {
        limit,
      });

      const transactions: SolanaTransaction[] = [];

      for (const sig of signatures) {
        transactions.push({
          signature: sig.signature,
          blockTime: sig.blockTime || 0,
          slot: sig.slot,
          confirmationStatus: sig.confirmationStatus || 'confirmed',
          fee: 0, // Fee would need to be fetched from full transaction
        });
      }

      return transactions;
    } catch (error) {
      this.logger.error(
        `Failed to get transactions for ${address}: ${error.message}`,
      );
      return [];
    }
  }

  /**
   * Get signatures for an address with filters
   * Useful for monitoring new transactions
   */
  async getSignaturesForAddress(
    address: string,
    beforeSignature?: string,
    limit = 10,
  ): Promise<ConfirmedSignatureInfo[]> {
    try {
      const connection = this.getConnection();
      const publicKey = new PublicKey(address);

      const options: any = { limit };
      if (beforeSignature) {
        options.before = beforeSignature;
      }

      return await connection.getSignaturesForAddress(publicKey, options);
    } catch (error) {
      this.logger.error(
        `Failed to get signatures for ${address}: ${error.message}`,
      );
      return [];
    }
  }

  /**
   * Check if transaction is confirmed
   */
  async isTransactionConfirmed(signature: string): Promise<boolean> {
    try {
      const connection = this.getConnection();
      const status = await connection.getSignatureStatus(signature);

      if (!status || !status.value) {
        return false;
      }

      // Check if transaction is finalized or confirmed
      return (
        status.value.confirmationStatus === 'finalized' ||
        status.value.confirmationStatus === 'confirmed'
      );
    } catch (error) {
      this.logger.error(`Failed to check transaction status: ${error.message}`);
      return false;
    }
  }

  /**
   * Get current slot (block height)
   */
  async getCurrentSlot(): Promise<number> {
    try {
      const connection = this.getConnection();
      return await connection.getSlot();
    } catch (error) {
      this.logger.error(`Failed to get current slot: ${error.message}`);
      return 0;
    }
  }

  /**
   * Get slot for a specific transaction
   */
  async getTransactionSlot(signature: string): Promise<number> {
    try {
      const transaction = await this.getTransaction(signature);
      return transaction?.slot || 0;
    } catch (error) {
      this.logger.error(`Failed to get transaction slot: ${error.message}`);
      return 0;
    }
  }

  /**
   * Calculate confirmations for a transaction
   */
  async getConfirmations(signature: string): Promise<number> {
    try {
      const [transaction, currentSlot] = await Promise.all([
        this.getTransaction(signature),
        this.getCurrentSlot(),
      ]);

      if (!transaction) {
        return 0;
      }

      return currentSlot - transaction.slot;
    } catch (error) {
      this.logger.error(`Failed to calculate confirmations: ${error.message}`);
      return 0;
    }
  }

  /**
   * Monitor address for incoming transactions
   * Uses polling approach to check for new transactions
   */
  async monitorAddress(
    address: string,
    callback: (tx: SolanaTransaction) => void,
    lastSignature?: string,
  ): Promise<string | undefined> {
    try {
      const signatures = await this.getSignaturesForAddress(
        address,
        lastSignature,
        10,
      );

      if (signatures.length === 0) {
        return lastSignature;
      }

      // Process new signatures
      for (const sig of signatures) {
        const tx = await this.getTransaction(sig.signature);
        if (tx) {
          callback(tx);
        }
      }

      // Return the latest signature for next poll
      return signatures[0].signature;
    } catch (error) {
      this.logger.error(
        `Failed to monitor address ${address}: ${error.message}`,
      );
      return lastSignature;
    }
  }

  /**
   * Validate Solana address format
   */
  isValidAddress(address: string): boolean {
    try {
      // Solana addresses are base58 encoded, 32-44 characters
      const publicKey = new PublicKey(address);
      return PublicKey.isOnCurve(publicKey.toBuffer());
    } catch {
      return false;
    }
  }

  /**
   * Get token account address for a wallet and token mint
   * This is the derived address where tokens are held
   */
  async getAssociatedTokenAddress(
    walletAddress: string,
    tokenMintAddress: string,
  ): Promise<string> {
    try {
      const connection = this.getConnection();
      const walletPublicKey = new PublicKey(walletAddress);
      const tokenMintPublicKey = new PublicKey(tokenMintAddress);

      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        walletPublicKey,
        {
          mint: tokenMintPublicKey,
        },
      );

      if (tokenAccounts.value.length === 0) {
        throw new Error('No token account found');
      }

      return tokenAccounts.value[0].pubkey.toString();
    } catch (error) {
      this.logger.error(
        `Failed to get token account address: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Parse SPL token transfer from transaction
   * Extracts transfer details from parsed transaction
   */
  async parseTokenTransfer(signature: string): Promise<{
    from: string;
    to: string;
    amount: string;
    tokenMint: string;
  } | null> {
    try {
      const connection = this.getConnection();
      const transaction = await connection.getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0,
      });

      if (!transaction || !transaction.meta) {
        return null;
      }

      // Look for SPL token transfer instructions
      const instructions = transaction.transaction.message.instructions;

      for (const instruction of instructions) {
        if ('parsed' in instruction && instruction.parsed) {
          const parsed = instruction.parsed;

          if (parsed.type === 'transfer' || parsed.type === 'transferChecked') {
            return {
              from: parsed.info.source,
              to: parsed.info.destination,
              amount: parsed.info.amount || parsed.info.tokenAmount?.amount,
              tokenMint: parsed.info.mint || '',
            };
          }
        }
      }

      return null;
    } catch (error) {
      this.logger.error(`Failed to parse token transfer: ${error.message}`);
      return null;
    }
  }

  /**
   * Get recent block hash (needed for transactions)
   */
  async getRecentBlockhash(): Promise<string> {
    try {
      const connection = this.getConnection();
      const { blockhash } = await connection.getLatestBlockhash();
      return blockhash;
    } catch (error) {
      this.logger.error(`Failed to get recent blockhash: ${error.message}`);
      throw error;
    }
  }

  /**
   * Sweep SPL tokens from deposit address to hot wallet
   * @param privateKey Private key of deposit address (hex string)
   * @param hotWalletAddress Hot wallet address to send tokens to
   * @param tokenMintAddress SPL token mint address (e.g., USDC mint)
   * @returns Transaction signature and sweep details
   */
  async sweepTokens(
    privateKey: string,
    hotWalletAddress: string,
    tokenMintAddress: string,
  ): Promise<{
    signature: string;
    amount: string;
    gasFee: string;
    success: boolean;
  }> {
    try {
      const connection = this.getConnection();

      // Create keypair from private key
      let keypair: Keypair;
      try {
        // Private key should be hex string without 0x prefix
        const cleanPrivateKey = privateKey.startsWith('0x')
          ? privateKey.slice(2)
          : privateKey;
        const privateKeyBytes = Buffer.from(cleanPrivateKey, 'hex');
        keypair = Keypair.fromSecretKey(privateKeyBytes);
      } catch (error) {
        this.logger.error(`Failed to create keypair: ${error.message}`);
        throw new Error('Invalid private key format');
      }

      const fromAddress = keypair.publicKey;
      const toAddressPubkey = new PublicKey(hotWalletAddress);
      const tokenMintPubkey = new PublicKey(tokenMintAddress);

      this.logger.log(
        `Sweeping tokens from ${fromAddress.toString()} to ${hotWalletAddress}`,
      );

      // Get the source token account (deposit address token account)
      const sourceTokenAccount = await getAssociatedTokenAddress(
        tokenMintPubkey,
        fromAddress,
      );

      // Get the destination token account (hot wallet token account)
      const destTokenAccount = await getAssociatedTokenAddress(
        tokenMintPubkey,
        toAddressPubkey,
      );

      // Get source token account info to get balance
      const sourceAccountInfo = await getAccount(
        connection,
        sourceTokenAccount,
      );

      const balance = sourceAccountInfo.amount;

      if (balance === BigInt(0)) {
        this.logger.warn(
          `Zero balance for token at ${fromAddress.toString()}`,
        );
        return {
          signature: '',
          amount: '0',
          gasFee: '0',
          success: false,
        };
      }

      this.logger.log(`Found token balance: ${balance.toString()}`);

      // Check if destination token account exists
      let destAccountExists = false;
      try {
        await getAccount(connection, destTokenAccount);
        destAccountExists = true;
      } catch (error) {
        // Account doesn't exist, we'll need to create it
        this.logger.warn(
          'Destination token account does not exist. Transaction will fail if hot wallet has no associated token account.',
        );
      }

      // Create transaction
      const transaction = new Transaction();

      // Add transfer instruction
      transaction.add(
        createTransferInstruction(
          sourceTokenAccount, // source
          destTokenAccount, // destination
          fromAddress, // owner of source account
          balance, // amount (transfer all)
          [], // multiSigners (empty for single signer)
          TOKEN_PROGRAM_ID,
        ),
      );

      // Get recent blockhash
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromAddress;

      // Sign transaction
      transaction.sign(keypair);

      // Send and confirm transaction
      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [keypair],
        {
          commitment: 'confirmed',
          maxRetries: 3,
        },
      );

      // Get transaction details to get fee
      const confirmedTx = await connection.getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0,
      });

      const fee = confirmedTx?.meta?.fee || 5000; // Default 5000 lamports if can't get fee

      this.logger.log(
        `Sweep successful! Signature: ${signature}, Amount: ${balance}, Fee: ${fee}`,
      );

      return {
        signature,
        amount: balance.toString(),
        gasFee: fee.toString(),
        success: true,
      };
    } catch (error) {
      this.logger.error(`Sweep transaction failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get token accounts for an address (used for sweep operations)
   * @param address Solana wallet address
   * @param tokenMintAddress Token mint address
   * @returns Token account information
   */
  async getTokenAccount(
    address: string,
    tokenMintAddress: string,
  ): Promise<{
    address: string;
    balance: string;
    decimals: number;
  } | null> {
    try {
      const connection = this.getConnection();
      const walletPublicKey = new PublicKey(address);
      const tokenMintPublicKey = new PublicKey(tokenMintAddress);

      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        walletPublicKey,
        {
          mint: tokenMintPublicKey,
        },
      );

      if (tokenAccounts.value.length === 0) {
        return null;
      }

      const tokenAccount = tokenAccounts.value[0];
      const parsedData = tokenAccount.account.data as ParsedAccountData;
      const tokenAmount = parsedData.parsed.info.tokenAmount;

      return {
        address: tokenAccount.pubkey.toString(),
        balance: tokenAmount.amount,
        decimals: tokenAmount.decimals,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get token account for ${address}: ${error.message}`,
      );
      return null;
    }
  }
}
