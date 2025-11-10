import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { NetworkType } from '@prisma/client';

@Injectable()
export class BlockchainService {
  private readonly logger = new Logger(BlockchainService.name);
  private providers: Map<NetworkType, ethers.providers.JsonRpcProvider>;

  constructor(private configService: ConfigService) {
    this.initializeProviders();
  }

  private initializeProviders() {
    this.providers = new Map();

    const networks = {
      ETHEREUM: this.configService.get<string>('blockchain.ethereum'),
      POLYGON: this.configService.get<string>('blockchain.polygon'),
      BSC: this.configService.get<string>('blockchain.bsc'),
      ARBITRUM: this.configService.get<string>('blockchain.arbitrum'),
      OPTIMISM: this.configService.get<string>('blockchain.optimism'),
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

  async getBalance(address: string, network: NetworkType): Promise<string> {
    const provider = this.getProvider(network);
    const balance = await provider.getBalance(address);
    return ethers.utils.formatEther(balance);
  }

  async getTokenBalance(
    tokenAddress: string,
    walletAddress: string,
    network: NetworkType,
  ): Promise<string> {
    const provider = this.getProvider(network);
    // ERC20 ABI for balanceOf
    const abi = ['function balanceOf(address) view returns (uint256)'];
    const contract = new ethers.Contract(tokenAddress, abi, provider);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const balance = await contract.balanceOf(walletAddress);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return ethers.utils.formatUnits(balance, 6); // USDT/USDC use 6 decimals
  }

  async getTransactionReceipt(txHash: string, network: NetworkType) {
    const provider = this.getProvider(network);
    return provider.getTransactionReceipt(txHash);
  }

  async getCurrentBlockNumber(network: NetworkType): Promise<number> {
    const provider = this.getProvider(network);
    return provider.getBlockNumber();
  }

  // Monitor address for incoming transactions
  monitorAddress(
    address: string,
    network: NetworkType,
    callback: (tx: any) => void,
  ) {
    const provider = this.getProvider(network);
    provider.on(address, (tx) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      this.logger.log(`New transaction detected for ${address}: ${tx.hash}`);
      callback(tx);
    });
  }
}
