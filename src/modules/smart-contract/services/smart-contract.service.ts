import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NetworkType } from '@prisma/client';
import { ethers } from 'ethers';

/**
 * Smart Contract Service
 *
 * Handles interactions with payment smart contracts across multiple blockchain networks:
 * - EVM Chains (Ethereum, Polygon, BSC, Arbitrum, Optimism, Avalanche, Base) - Solidity
 * - Sui Network - Move
 * - TON Network - Tact
 * - Solana - Rust (existing)
 */
@Injectable()
export class SmartContractService {
  private readonly logger = new Logger(SmartContractService.name);
  private readonly providers: Map<
    NetworkType,
    ethers.providers.JsonRpcProvider
  > = new Map();
  private readonly contracts: Map<NetworkType, ethers.Contract> = new Map();

  // EVM-based networks that share the same Solidity contract
  private readonly EVM_NETWORKS: NetworkType[] = [
    NetworkType.ETHEREUM,
    NetworkType.POLYGON,
    NetworkType.BSC,
    NetworkType.ARBITRUM,
    NetworkType.OPTIMISM,
    NetworkType.AVALANCHE,
    NetworkType.BASE,
  ];

  // Contract ABI for EVM chains (OxMartPayment.sol)
  private readonly EVM_CONTRACT_ABI = [
    // View functions
    'function hotWallet() view returns (address)',
    'function platformFeeBps() view returns (uint16)',
    'function isPaused() view returns (bool)',
    'function supportedTokens(address) view returns (bool)',
    'function processedOrders(string) view returns (bool)',
    'function owner() view returns (address)',

    // Events
    'event PaymentReceived(string indexed orderId, address indexed buyer, address indexed tokenAddress, uint256 amount, uint256 platformFee, address apiKeyOwner, uint256 commission, uint16 commissionBps, string productId)',
    'event HotWalletUpdated(address indexed oldWallet, address indexed newWallet)',
    'event TokenSupportChanged(address indexed tokenAddress, bool isSupported)',
    'event PlatformFeeUpdated(uint16 oldFeeBps, uint16 newFeeBps)',
    'event ContractPaused()',
    'event ContractUnpaused()',

    // Admin functions (not used by payment flow)
    'function addSupportedToken(address tokenAddress)',
    'function removeSupportedToken(address tokenAddress)',
    'function updateHotWallet(address newHotWallet)',
    'function updatePlatformFee(uint16 newFeeBps)',
    'function pause()',
    'function unpause()',
  ];

  constructor(private configService: ConfigService) {
    this.initializeProviders();
  }

  /**
   * Initialize RPC providers for all supported networks
   */
  private initializeProviders() {
    try {
      // Ethereum
      const ethRpc = this.configService.get<string>('ETHEREUM_RPC_URL');
      if (ethRpc) {
        this.providers.set(
          NetworkType.ETHEREUM,
          new ethers.providers.JsonRpcProvider(ethRpc),
        );
        this.logger.log('Initialized Ethereum provider');
      }

      // Polygon
      const polygonRpc = this.configService.get<string>('POLYGON_RPC_URL');
      if (polygonRpc) {
        this.providers.set(
          NetworkType.POLYGON,
          new ethers.providers.JsonRpcProvider(polygonRpc),
        );
        this.logger.log('Initialized Polygon provider');
      }

      // BSC
      const bscRpc = this.configService.get<string>('BSC_RPC_URL');
      if (bscRpc) {
        this.providers.set(
          NetworkType.BSC,
          new ethers.providers.JsonRpcProvider(bscRpc),
        );
        this.logger.log('Initialized BSC provider');
      }

      // Arbitrum
      const arbitrumRpc = this.configService.get<string>('ARBITRUM_RPC_URL');
      if (arbitrumRpc) {
        this.providers.set(
          NetworkType.ARBITRUM,
          new ethers.providers.JsonRpcProvider(arbitrumRpc),
        );
        this.logger.log('Initialized Arbitrum provider');
      }

      // Optimism
      const optimismRpc = this.configService.get<string>('OPTIMISM_RPC_URL');
      if (optimismRpc) {
        this.providers.set(
          NetworkType.OPTIMISM,
          new ethers.providers.JsonRpcProvider(optimismRpc),
        );
        this.logger.log('Initialized Optimism provider');
      }

      // Avalanche
      const avalancheRpc = this.configService.get<string>('AVALANCHE_RPC_URL');
      if (avalancheRpc) {
        this.providers.set(
          NetworkType.AVALANCHE,
          new ethers.providers.JsonRpcProvider(avalancheRpc),
        );
        this.logger.log('Initialized Avalanche provider');
      }

      // Base
      const baseRpc = this.configService.get<string>('BASE_RPC_URL');
      if (baseRpc) {
        this.providers.set(
          NetworkType.BASE,
          new ethers.providers.JsonRpcProvider(baseRpc),
        );
        this.logger.log('Initialized Base provider');
      }

      // Initialize contracts for EVM networks
      this.initializeContracts();
    } catch (error) {
      this.logger.error('Failed to initialize providers', error);
    }
  }

  /**
   * Initialize contract instances for all networks
   */
  private initializeContracts() {
    // EVM contracts
    for (const network of this.EVM_NETWORKS) {
      const provider = this.providers.get(network);
      if (!provider) continue;

      const contractAddress = this.getContractAddress(network);
      if (!contractAddress) {
        this.logger.warn(`No contract address configured for ${network}`);
        continue;
      }

      try {
        const contract = new ethers.Contract(
          contractAddress,
          this.EVM_CONTRACT_ABI,
          provider,
        );
        this.contracts.set(network, contract);
        this.logger.log(
          `Initialized contract for ${network} at ${contractAddress}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to initialize contract for ${network}`,
          error,
        );
      }
    }
  }

  /**
   * Get contract address for a specific network
   */
  getContractAddress(network: NetworkType): string | null {
    const envKey = `${network.toUpperCase()}_CONTRACT_ADDRESS`;
    return this.configService.get<string>(envKey) || null;
  }

  /**
   * Get contract ABI for a specific network
   */
  getContractABI(network: NetworkType): any {
    if (this.EVM_NETWORKS.includes(network)) {
      return this.EVM_CONTRACT_ABI;
    }

    // For non-EVM networks, return appropriate ABI/interface
    switch (network) {
      case NetworkType.SUI:
        return this.getSuiContractInterface();
      case NetworkType.TON:
        return this.getTonContractInterface();
      case NetworkType.SOLANA:
        return this.getSolanaContractInterface();
      default:
        return [];
    }
  }

  /**
   * Get Sui contract interface description
   */
  private getSuiContractInterface() {
    return {
      packageId: this.configService.get<string>('SUI_PACKAGE_ID'),
      module: 'payment',
      functions: {
        process_payment: {
          typeParameters: ['T'],
          parameters: [
            'config: &mut PaymentConfig',
            'order_id: vector<u8>',
            'payment: Coin<T>',
            'product_id: String',
            'api_key_owner: address',
            'commission_bps: u64',
          ],
        },
      },
    };
  }

  /**
   * Get TON contract interface description
   */
  private getTonContractInterface() {
    return {
      contractAddress: this.configService.get<string>('TON_CONTRACT_ADDRESS'),
      messages: {
        ProcessPayment: {
          orderId: 'String',
          tokenAddress: 'Address',
          amount: 'Int as coins',
          productId: 'String',
          apiKeyOwner: 'Address',
          commissionBps: 'Int as uint16',
        },
      },
    };
  }

  /**
   * Get Solana contract interface
   */
  private getSolanaContractInterface() {
    return {
      programId: this.configService.get<string>('SOLANA_PROGRAM_ID'),
    };
  }

  /**
   * Check if a network is EVM-based
   */
  isEVMNetwork(network: NetworkType): boolean {
    return this.EVM_NETWORKS.includes(network);
  }

  /**
   * Get contract instance for a network
   */
  getContract(network: NetworkType): ethers.Contract | null {
    return this.contracts.get(network) || null;
  }

  /**
   * Get RPC provider for a network
   */
  getProvider(network: NetworkType): ethers.providers.JsonRpcProvider | null {
    return this.providers.get(network) || null;
  }

  /**
   * Get transaction receipt and details
   */
  async getTransactionReceipt(network: NetworkType, txHash: string) {
    const provider = this.getProvider(network);
    if (!provider) {
      throw new Error(`Provider not initialized for ${network}`);
    }

    try {
      const receipt = await provider.getTransactionReceipt(txHash);
      if (!receipt) {
        return null;
      }

      return {
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber.toString(),
        blockHash: receipt.blockHash,
        from: receipt.from,
        to: receipt.to,
        gasUsed: receipt.gasUsed.toString(),
        status: receipt.status === 1 ? 'success' : 'failed',
        confirmations: (await provider.getBlockNumber()) - receipt.blockNumber,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get transaction receipt for ${txHash} on ${network}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get payment event data from transaction receipt
   */
  async getPaymentEventFromReceipt(network: NetworkType, txHash: string) {
    if (!this.isEVMNetwork(network)) {
      this.logger.warn(`Event parsing not implemented for ${network}`);
      return null;
    }

    const provider = this.getProvider(network);
    const contract = this.getContract(network);

    if (!provider || !contract) {
      throw new Error(`Provider or contract not initialized for ${network}`);
    }

    try {
      const receipt = await provider.getTransactionReceipt(txHash);
      if (!receipt) {
        return null;
      }

      const iface = new ethers.utils.Interface(this.EVM_CONTRACT_ABI);

      for (const log of receipt.logs) {
        try {
          const parsedLog = iface.parseLog({
            topics: log.topics,
            data: log.data,
          });

          if (parsedLog && parsedLog.name === 'PaymentReceived') {
            return {
              orderId: parsedLog.args.orderId,
              buyer: parsedLog.args.buyer,
              tokenAddress: parsedLog.args.tokenAddress,
              amount: parsedLog.args.amount.toString(),
              platformFee: parsedLog.args.platformFee.toString(),
              apiKeyOwner: parsedLog.args.apiKeyOwner,
              commission: parsedLog.args.commission.toString(),
              commissionBps: Number(parsedLog.args.commissionBps),
              productId: parsedLog.args.productId,
            };
          }
        } catch (e) {
          continue;
        }
      }

      return null;
    } catch (error) {
      this.logger.error(
        `Failed to parse payment event from ${txHash} on ${network}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get all available networks
   */
  getAvailableNetworks(): NetworkType[] {
    return Object.values(NetworkType);
  }

  /**
   * Get network display name
   */
  getNetworkDisplayName(network: NetworkType): string {
    const names = {
      [NetworkType.ETHEREUM]: 'Ethereum',
      [NetworkType.POLYGON]: 'Polygon',
      [NetworkType.BSC]: 'BNB Smart Chain',
      [NetworkType.ARBITRUM]: 'Arbitrum',
      [NetworkType.OPTIMISM]: 'Optimism',
      [NetworkType.AVALANCHE]: 'Avalanche',
      [NetworkType.BASE]: 'Base',
      [NetworkType.SUI]: 'Sui',
      [NetworkType.TON]: 'TON',
      [NetworkType.SOLANA]: 'Solana',
    };
    return names[network] || network;
  }

  /**
   * Get network logo/icon URL
   */
  getNetworkIcon(network: NetworkType): string {
    const icons = {
      [NetworkType.ETHEREUM]: '/icons/networks/ethereum.svg',
      [NetworkType.POLYGON]: '/icons/networks/polygon.svg',
      [NetworkType.BSC]: '/icons/networks/bnb.svg',
      [NetworkType.ARBITRUM]: '/icons/networks/arbitrum.svg',
      [NetworkType.OPTIMISM]: '/icons/networks/optimism.svg',
      [NetworkType.AVALANCHE]: '/icons/networks/avalanche.svg',
      [NetworkType.BASE]: '/icons/networks/base.svg',
      [NetworkType.SUI]: '/icons/networks/sui.svg',
      [NetworkType.TON]: '/icons/networks/ton.svg',
      [NetworkType.SOLANA]: '/icons/networks/solana.svg',
    };
    return icons[network] || '/icons/networks/default.svg';
  }
}
