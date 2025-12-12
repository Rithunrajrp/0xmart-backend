import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { NetworkType } from '@prisma/client';
import { TonBlockchainService } from './ton-blockchain.service';
import { SolanaBlockchainService } from './solana-blockchain.service';
import { SuiBlockchainService } from './sui-blockchain.service';

@Injectable()
export class BlockchainService {
  private readonly logger = new Logger(BlockchainService.name);
  private providers: Map<NetworkType, ethers.providers.JsonRpcProvider>;
  private tonService: TonBlockchainService;
  private solanaService: SolanaBlockchainService;
  private suiService: SuiBlockchainService;

  constructor(private configService: ConfigService) {
    this.initializeProviders();
    this.tonService = new TonBlockchainService(configService);
    this.solanaService = new SolanaBlockchainService(configService);
    this.suiService = new SuiBlockchainService(configService);
  }

  private initializeProviders() {
    this.providers = new Map();

    const networks = {
      ETHEREUM: this.configService.get<string>('blockchain.ethereum'),
      POLYGON: this.configService.get<string>('blockchain.polygon'),
      BSC: this.configService.get<string>('blockchain.bsc'),
      ARBITRUM: this.configService.get<string>('blockchain.arbitrum'),
      OPTIMISM: this.configService.get<string>('blockchain.optimism'),
      AVALANCHE: this.configService.get<string>('blockchain.avalanche'),
      BASE: this.configService.get<string>('blockchain.base'),
      // SUI and TON require different providers (not EVM-compatible)
      // They will be handled separately if needed
    };

    for (const [network, rpcUrl] of Object.entries(networks)) {
      if (rpcUrl) {
        this.providers.set(
          network as NetworkType,
          new ethers.providers.JsonRpcProvider(rpcUrl),
        );
        this.logger.log(`✅ ${network} provider initialized`);
      }
    }
  }

  getProvider(network: NetworkType): ethers.providers.JsonRpcProvider {
    const provider = this.providers.get(network);
    if (!provider) {
      throw new Error(`Provider for network ${network} not configured`);
    }
    return provider;
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
}
