import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { NetworkType } from '@prisma/client';
import { TonBlockchainService } from './ton-blockchain.service';
import { SolanaBlockchainService } from './solana-blockchain.service';
import { SuiBlockchainService } from './sui-blockchain.service';
import { SecretsService } from '../../secrets/secrets.service';

interface ProviderCacheEntry {
  provider: ethers.providers.JsonRpcProvider;
  lastAccessed: number;
}

@Injectable()
export class BlockchainService implements OnModuleDestroy {
  private readonly logger = new Logger(BlockchainService.name);
  private providerCache: Map<NetworkType, ProviderCacheEntry> = new Map();
  private readonly MAX_CACHE_SIZE = 10;
  private readonly CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
  private cleanupInterval: NodeJS.Timeout;
  private tonService: TonBlockchainService;
  private solanaService: SolanaBlockchainService;
  private suiService: SuiBlockchainService;

  constructor(
    private configService: ConfigService,
    private secretsService: SecretsService,
  ) {
    this.tonService = new TonBlockchainService(configService);
    this.solanaService = new SolanaBlockchainService(configService);
    this.suiService = new SuiBlockchainService(configService);

    // Start cleanup interval to remove stale providers
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleProviders();
    }, 10 * 60 * 1000); // Run every 10 minutes
  }

  private getRpcUrl(network: NetworkType): string {
    const rpcUrls: Record<string, string | undefined> = {
      ETHEREUM: this.configService.get<string>('blockchain.ethereum'),
      POLYGON: this.configService.get<string>('blockchain.polygon'),
      BSC: this.configService.get<string>('blockchain.bsc'),
      ARBITRUM: this.configService.get<string>('blockchain.arbitrum'),
      OPTIMISM: this.configService.get<string>('blockchain.optimism'),
      AVALANCHE: this.configService.get<string>('blockchain.avalanche'),
      BASE: this.configService.get<string>('blockchain.base'),
    };

    const rpcUrl = rpcUrls[network];
    if (!rpcUrl) {
      throw new Error(`RPC URL for network ${network} not configured`);
    }
    return rpcUrl;
  }

  private disposeProvider(provider: ethers.providers.JsonRpcProvider) {
    try {
      // Remove all event listeners to prevent memory leaks
      provider.removeAllListeners();

      // Note: JsonRpcProvider doesn't have explicit destroy/disconnect methods
      // but removing listeners prevents memory leaks from event accumulation
      this.logger.debug('Provider disposed and listeners removed');
    } catch (error) {
      this.logger.error(`Error disposing provider: ${error.message}`);
    }
  }

  private cleanupStaleProviders() {
    const now = Date.now();
    const entriesToRemove: NetworkType[] = [];

    for (const [network, entry] of this.providerCache.entries()) {
      const age = now - entry.lastAccessed;
      if (age > this.CACHE_TTL_MS) {
        entriesToRemove.push(network);
      }
    }

    for (const network of entriesToRemove) {
      const entry = this.providerCache.get(network);
      if (entry) {
        this.disposeProvider(entry.provider);
        this.providerCache.delete(network);
        this.logger.debug(`Removed stale provider for ${network}`);
      }
    }

    if (entriesToRemove.length > 0) {
      this.logger.log(`Cleaned up ${entriesToRemove.length} stale provider(s)`);
    }
  }

  private evictLRUProvider() {
    if (this.providerCache.size < this.MAX_CACHE_SIZE) {
      return; // No need to evict
    }

    // Find least recently used provider
    let lruNetwork: NetworkType | null = null;
    let oldestTime = Date.now();

    for (const [network, entry] of this.providerCache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        lruNetwork = network;
      }
    }

    if (lruNetwork) {
      const entry = this.providerCache.get(lruNetwork);
      if (entry) {
        this.disposeProvider(entry.provider);
        this.providerCache.delete(lruNetwork);
        this.logger.debug(`Evicted LRU provider for ${lruNetwork}`);
      }
    }
  }

  getProvider(network: NetworkType): ethers.providers.JsonRpcProvider {
    // Check if provider exists in cache
    const cached = this.providerCache.get(network);

    if (cached) {
      // Update last accessed time
      cached.lastAccessed = Date.now();
      return cached.provider;
    }

    // Provider not cached - create new one
    this.evictLRUProvider(); // Evict LRU if cache is full

    const rpcUrl = this.getRpcUrl(network);
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl, {
      name: network.toLowerCase(),
      chainId: this.getChainId(network),
    });

    // Configure provider with timeouts and connection limits
    provider.pollingInterval = 12000; // 12 seconds (default block time for most chains)

    // Cache the provider
    this.providerCache.set(network, {
      provider,
      lastAccessed: Date.now(),
    });

    this.logger.log(`✅ ${network} provider created and cached`);
    return provider;
  }

  private getChainId(network: NetworkType): number {
    const chainIds: Record<string, number> = {
      ETHEREUM: 1,
      POLYGON: 137,
      BSC: 56,
      ARBITRUM: 42161,
      OPTIMISM: 10,
      AVALANCHE: 43114,
      BASE: 8453,
    };
    return chainIds[network] || 1;
  }

  /**
   * Cleanup method to be called on module destruction
   */
  onModuleDestroy() {
    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Dispose all cached providers
    for (const [network, entry] of this.providerCache.entries()) {
      this.disposeProvider(entry.provider);
    }
    this.providerCache.clear();
    this.logger.log('All blockchain providers disposed');
  }

  /**
   * Get TON service instance
   */
  getTonService(): TonBlockchainService {
    return this.tonService;
  }

  /**
   * Get Solana service instance
   */
  getSolanaService(): SolanaBlockchainService {
    return this.solanaService;
  }

  /**
   * Get SUI service instance
   */
  getSuiService(): SuiBlockchainService {
    return this.suiService;
  }

  /**
   * Check if network is EVM-compatible
   */
  private isEvmNetwork(network: NetworkType): boolean {
    const evmNetworks: NetworkType[] = [
      'ETHEREUM',
      'POLYGON',
      'BSC',
      'ARBITRUM',
      'OPTIMISM',
      'AVALANCHE',
      'BASE',
    ];
    return evmNetworks.includes(network);
  }

  async getBalance(address: string, network: NetworkType): Promise<string> {
    // Route to appropriate service based on network
    if (network === 'TON') {
      return this.tonService.getBalance(address);
    }

    if (network === 'SOLANA') {
      return this.solanaService.getBalance(address);
    }

    if (network === 'SUI') {
      return this.suiService.getBalance(address);
    }

    // EVM networks
    const provider = this.getProvider(network);
    const balance = await provider.getBalance(address);
    return ethers.utils.formatEther(balance);
  }

  async getTokenBalance(
    tokenAddress: string,
    walletAddress: string,
    network: NetworkType,
  ): Promise<string> {
    // Route to appropriate service based on network
    if (network === 'TON') {
      const balance = await this.tonService.getJettonBalance(
        tokenAddress,
        walletAddress,
      );
      return (
        parseFloat(balance.balance) / Math.pow(10, balance.decimals)
      ).toString();
    }

    if (network === 'SOLANA') {
      const balance = await this.solanaService.getTokenBalance(
        tokenAddress,
        walletAddress,
      );
      return balance.uiAmount.toString();
    }

    if (network === 'SUI') {
      const balance = await this.suiService.getCoinBalance(
        walletAddress,
        tokenAddress,
      );
      // Get coin metadata to determine decimals
      const metadata = await this.suiService.getCoinMetadata(tokenAddress);
      const decimals = metadata?.decimals || 9;
      return (
        parseFloat(balance.totalBalance) / Math.pow(10, decimals)
      ).toString();
    }

    // EVM networks
    const provider = this.getProvider(network);
    // ERC20 ABI for balanceOf
    const abi = ['function balanceOf(address) view returns (uint256)'];
    const contract = new ethers.Contract(tokenAddress, abi, provider);

    const balance = await contract.balanceOf(walletAddress);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return ethers.utils.formatUnits(balance, 6); // USDT/USDC use 6 decimals
  }

  async getTransactionReceipt(txHash: string, network: NetworkType) {
    // TON, Solana, and SUI have different transaction models
    if (network === 'TON') {
      return this.tonService.getTransaction(txHash);
    }

    if (network === 'SOLANA') {
      return this.solanaService.getTransaction(txHash);
    }

    if (network === 'SUI') {
      return this.suiService.getTransaction(txHash);
    }

    // EVM networks
    const provider = this.getProvider(network);
    return provider.getTransactionReceipt(txHash);
  }

  async getCurrentBlockNumber(network: NetworkType): Promise<number> {
    if (network === 'TON') {
      return this.tonService.getCurrentBlock();
    }

    if (network === 'SOLANA') {
      return this.solanaService.getCurrentSlot();
    }

    // EVM networks
    const provider = this.getProvider(network);
    return provider.getBlockNumber();
  }

  // Monitor address for incoming transactions
  monitorAddress(
    address: string,
    network: NetworkType,
    callback: (tx: any) => void,
  ) {
    if (network === 'TON') {
      this.tonService.monitorAddress(address, callback);
      return;
    }

    if (network === 'SOLANA') {
      // Solana monitoring requires polling
      this.logger.log(`Monitoring Solana address: ${address}`);
      // Implementation would be in deposit-monitor service
      return;
    }

    // EVM networks
    const provider = this.getProvider(network);
    provider.on(address, (tx) => {
      this.logger.log(`New transaction detected for ${address}: ${tx.hash}`);
      callback(tx);
    });
  }

  /**
   * Transfer tokens from master wallet to destination address
   * Used for payment distribution to merchants and platform owner
   */
  async transfer(
    network: NetworkType,
    stablecoinType: string,
    toAddress: string,
    amount: any, // Decimal type from Prisma
  ): Promise<string> {
    this.logger.log(
      `Initiating transfer: ${amount} ${stablecoinType} on ${network} to ${toAddress}`,
    );

    // SEC-BE-003 FIX: Get master wallet private key from AWS Secrets Manager
    const masterPrivateKey = await this.secretsService.getMasterWalletPrivateKey();

    if (!masterPrivateKey) {
      throw new Error(
        'MASTER_WALLET_PRIVATE_KEY not configured. Cannot send transactions.',
      );
    }

    // Handle non-EVM chains
    if (network === 'TON') {
      // TON transfer implementation would go here
      throw new Error('TON transfers not yet implemented');
    }

    if (network === 'SOLANA') {
      // Solana transfer implementation would go here
      throw new Error('Solana transfers not yet implemented');
    }

    if (network === 'SUI') {
      // SUI transfer implementation would go here
      throw new Error('SUI transfers not yet implemented');
    }

    // EVM networks (Ethereum, Polygon, BSC, Arbitrum, Optimism, Avalanche, Base)
    const provider = this.getProvider(network);
    const wallet = new ethers.Wallet(masterPrivateKey, provider);

    // Get token contract address
    const tokenAddress = this.getTokenAddress(network, stablecoinType);

    if (!tokenAddress) {
      throw new Error(
        `Token address not configured for ${stablecoinType} on ${network}`,
      );
    }

    // ERC20 ABI for transfer
    const erc20Abi = [
      'function transfer(address to, uint256 amount) returns (bool)',
      'function decimals() view returns (uint8)',
    ];

    const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, wallet);

    // Get token decimals
    const decimals = await tokenContract.decimals();

    // Convert amount to token units
    const amountInTokenUnits = ethers.utils.parseUnits(
      amount.toString(),
      decimals,
    );

    // Send transfer transaction
    const tx = await tokenContract.transfer(toAddress, amountInTokenUnits);

    this.logger.log(
      `Transfer transaction sent: ${tx.hash}. Waiting for confirmation...`,
    );

    // Wait for transaction confirmation
    const receipt = await tx.wait();

    if (receipt.status === 0) {
      throw new Error('Transaction failed');
    }

    this.logger.log(
      `Transfer confirmed: ${tx.hash} in block ${receipt.blockNumber}`,
    );

    return tx.hash;
  }

  /**
   * Get token contract address for a stablecoin on a specific network
   */
  private getTokenAddress(network: NetworkType, stablecoinType: string): string | null {
    // Token addresses from deposit-monitor service
    // These should match the addresses in deposit-monitor.service.ts
    const tokenAddresses: Record<NetworkType, Record<string, string>> = {
      ETHEREUM: {
        USDT: '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06', // Sepolia USDT
        USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // Sepolia USDC
        DAI: '0x68194a729C2450ad26072b3D33ADaCbcef39D574', // Sepolia DAI
        BUSD: '0x0000000000000000000000000000000000000000',
      },
      POLYGON: {
        USDT: '0xfe4F5145f6e09952a5ba9e956ED0C25e3Fa4c7F1', // Amoy USDT
        USDC: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582', // Amoy USDC
        DAI: '0x001B3B4d0F3714Ca98ba10F6042DaEbF0B1B7b6F', // Amoy DAI
        BUSD: '0x0000000000000000000000000000000000000000',
      },
      BSC: {
        USDT: '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd', // BSC Testnet USDT
        USDC: '0x64544969ed7EBf5f083679233325356EbE738930', // BSC Testnet USDC
        DAI: '0x0000000000000000000000000000000000000000',
        BUSD: '0x0000000000000000000000000000000000000000',
      },
      ARBITRUM: {
        USDT: '0xfd064a18f3bf249cf1f87fc203e90d8f650f2d63', // Arbitrum Sepolia USDT
        USDC: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d', // Arbitrum Sepolia USDC
        DAI: '0x0000000000000000000000000000000000000000',
        BUSD: '0x0000000000000000000000000000000000000000',
      },
      OPTIMISM: {
        USDT: '0x0000000000000000000000000000000000000000',
        USDC: '0x0000000000000000000000000000000000000000',
        DAI: '0x0000000000000000000000000000000000000000',
        BUSD: '0x0000000000000000000000000000000000000000',
      },
      AVALANCHE: {
        USDT: '0x0000000000000000000000000000000000000000',
        USDC: '0x0000000000000000000000000000000000000000',
        DAI: '0x0000000000000000000000000000000000000000',
        BUSD: '0x0000000000000000000000000000000000000000',
      },
      BASE: {
        USDT: '0x0000000000000000000000000000000000000000',
        USDC: '0x0000000000000000000000000000000000000000',
        DAI: '0x0000000000000000000000000000000000000000',
        BUSD: '0x0000000000000000000000000000000000000000',
      },
      SUI: {
        USDT: '0x0000000000000000000000000000000000000000',
        USDC: '0x0000000000000000000000000000000000000000',
        DAI: '0x0000000000000000000000000000000000000000',
        BUSD: '0x0000000000000000000000000000000000000000',
      },
      TON: {
        USDT: '0x0000000000000000000000000000000000000000',
        USDC: '0x0000000000000000000000000000000000000000',
        DAI: '0x0000000000000000000000000000000000000000',
        BUSD: '0x0000000000000000000000000000000000000000',
      },
      SOLANA: {
        USDT: '0x0000000000000000000000000000000000000000',
        USDC: '0x0000000000000000000000000000000000000000',
        DAI: '0x0000000000000000000000000000000000000000',
        BUSD: '0x0000000000000000000000000000000000000000',
      },
    };

    const networkTokens = tokenAddresses[network];
    if (!networkTokens) {
      return null;
    }

    const tokenAddress = networkTokens[stablecoinType];
    if (!tokenAddress || tokenAddress === '0x0000000000000000000000000000000000000000') {
      return null;
    }

    return tokenAddress;
  }
}
