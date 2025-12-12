/**
 * Smart Contract Addresses
 *
 * Store deployed contract addresses for each network
 * Update these after deploying contracts to each network
 */

export enum NetworkType {
  // EVM Networks
  ETHEREUM = 'ethereum',
  POLYGON = 'polygon',
  BSC = 'bsc',
  ARBITRUM = 'arbitrum',
  OPTIMISM = 'optimism',
  AVALANCHE = 'avalanche',
  BASE = 'base',

  // Solana
  SOLANA = 'solana',

  // Testnets
  SEPOLIA = 'sepolia',
  MUMBAI = 'mumbai',
  BSC_TESTNET = 'bsc-testnet',
  ARBITRUM_SEPOLIA = 'arbitrum-sepolia',
  OPTIMISM_SEPOLIA = 'optimism-sepolia',
  AVALANCHE_FUJI = 'avalanche-fuji',
  BASE_SEPOLIA = 'base-sepolia',
  SOLANA_DEVNET = 'solana-devnet',
}

export interface ContractAddresses {
  payment: string;
  tokens: {
    USDT: string;
    USDC: string;
    DAI: string;
    BUSD: string;
  };
}

/**
 * EVM Contract Addresses
 */
export const EVM_CONTRACT_ADDRESSES: Record<
  NetworkType,
  ContractAddresses | null
> = {
  // Testnets
  [NetworkType.SEPOLIA]: {
    payment:
      process.env.SEPOLIA_PAYMENT_CONTRACT ||
      '0x0000000000000000000000000000000000000000',
    tokens: {
      USDT:
        process.env.SEPOLIA_USDT ||
        '0x0000000000000000000000000000000000000000',
      USDC:
        process.env.SEPOLIA_USDC ||
        '0x0000000000000000000000000000000000000000',
      DAI:
        process.env.SEPOLIA_DAI || '0x0000000000000000000000000000000000000000',
      BUSD:
        process.env.SEPOLIA_BUSD ||
        '0x0000000000000000000000000000000000000000',
    },
  },
  [NetworkType.MUMBAI]: {
    payment:
      process.env.MUMBAI_PAYMENT_CONTRACT ||
      '0x0000000000000000000000000000000000000000',
    tokens: {
      USDT: '0x0000000000000000000000000000000000000000',
      USDC: '0x0000000000000000000000000000000000000000',
      DAI: '0x0000000000000000000000000000000000000000',
      BUSD: '0x0000000000000000000000000000000000000000',
    },
  },
  [NetworkType.BSC_TESTNET]: {
    payment:
      process.env.BSC_TESTNET_PAYMENT_CONTRACT ||
      '0x0000000000000000000000000000000000000000',
    tokens: {
      USDT: '0x0000000000000000000000000000000000000000',
      USDC: '0x0000000000000000000000000000000000000000',
      DAI: '0x0000000000000000000000000000000000000000',
      BUSD: '0x0000000000000000000000000000000000000000',
    },
  },
  [NetworkType.ARBITRUM_SEPOLIA]: {
    payment:
      process.env.ARBITRUM_SEPOLIA_PAYMENT_CONTRACT ||
      '0x0000000000000000000000000000000000000000',
    tokens: {
      USDT: '0x0000000000000000000000000000000000000000',
      USDC: '0x0000000000000000000000000000000000000000',
      DAI: '0x0000000000000000000000000000000000000000',
      BUSD: '0x0000000000000000000000000000000000000000',
    },
  },
  [NetworkType.OPTIMISM_SEPOLIA]: {
    payment:
      process.env.OPTIMISM_SEPOLIA_PAYMENT_CONTRACT ||
      '0x0000000000000000000000000000000000000000',
    tokens: {
      USDT: '0x0000000000000000000000000000000000000000',
      USDC: '0x0000000000000000000000000000000000000000',
      DAI: '0x0000000000000000000000000000000000000000',
      BUSD: '0x0000000000000000000000000000000000000000',
    },
  },
  [NetworkType.AVALANCHE_FUJI]: {
    payment:
      process.env.AVALANCHE_FUJI_PAYMENT_CONTRACT ||
      '0x0000000000000000000000000000000000000000',
    tokens: {
      USDT: '0x0000000000000000000000000000000000000000',
      USDC: '0x0000000000000000000000000000000000000000',
      DAI: '0x0000000000000000000000000000000000000000',
      BUSD: '0x0000000000000000000000000000000000000000',
    },
  },
  [NetworkType.BASE_SEPOLIA]: {
    payment:
      process.env.BASE_SEPOLIA_PAYMENT_CONTRACT ||
      '0x0000000000000000000000000000000000000000',
    tokens: {
      USDT: '0x0000000000000000000000000000000000000000',
      USDC: '0x0000000000000000000000000000000000000000',
      DAI: '0x0000000000000000000000000000000000000000',
      BUSD: '0x0000000000000000000000000000000000000000',
    },
  },

  // Mainnets
  [NetworkType.ETHEREUM]: {
    payment:
      process.env.ETHEREUM_PAYMENT_CONTRACT ||
      '0x0000000000000000000000000000000000000000',
    tokens: {
      USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      BUSD: '0x4Fabb145d64652a948d72533023f6E7A623C7C53',
    },
  },
  [NetworkType.POLYGON]: {
    payment:
      process.env.POLYGON_PAYMENT_CONTRACT ||
      '0x0000000000000000000000000000000000000000',
    tokens: {
      USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
      USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
      DAI: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
      BUSD: '0xdAb529f40E671A1D4bF91361c21bf9f0C9712ab7',
    },
  },
  [NetworkType.BSC]: {
    payment:
      process.env.BSC_PAYMENT_CONTRACT ||
      '0x0000000000000000000000000000000000000000',
    tokens: {
      USDT: '0x55d398326f99059fF775485246999027B3197955',
      USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
      DAI: '0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3',
      BUSD: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
    },
  },
  [NetworkType.ARBITRUM]: {
    payment:
      process.env.ARBITRUM_PAYMENT_CONTRACT ||
      '0x0000000000000000000000000000000000000000',
    tokens: {
      USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
      USDC: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
      DAI: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
      BUSD: '0x0000000000000000000000000000000000000000',
    },
  },
  [NetworkType.OPTIMISM]: {
    payment:
      process.env.OPTIMISM_PAYMENT_CONTRACT ||
      '0x0000000000000000000000000000000000000000',
    tokens: {
      USDT: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
      USDC: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
      DAI: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
      BUSD: '0x0000000000000000000000000000000000000000',
    },
  },
  [NetworkType.AVALANCHE]: {
    payment:
      process.env.AVALANCHE_PAYMENT_CONTRACT ||
      '0x0000000000000000000000000000000000000000',
    tokens: {
      USDT: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
      USDC: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
      DAI: '0xd586E7F844cEa2F87f50152665BCbc2C279D8d70',
      BUSD: '0x0000000000000000000000000000000000000000',
    },
  },
  [NetworkType.BASE]: {
    payment:
      process.env.BASE_PAYMENT_CONTRACT ||
      '0x0000000000000000000000000000000000000000',
    tokens: {
      USDT: '0x0000000000000000000000000000000000000000',
      USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      DAI: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
      BUSD: '0x0000000000000000000000000000000000000000',
    },
  },

  // Non-EVM
  [NetworkType.SOLANA]: null,
  [NetworkType.SOLANA_DEVNET]: null,
};

/**
 * Solana Program Addresses
 */
export const SOLANA_PROGRAM_ADDRESSES = {
  mainnet: {
    programId:
      process.env.SOLANA_PROGRAM_ID ||
      '9xMartPayment11111111111111111111111111111',
    tokens: {
      USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
      PYUSD: '2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo',
    },
  },
  devnet: {
    programId:
      process.env.SOLANA_DEVNET_PROGRAM_ID ||
      '9xMartPayment11111111111111111111111111111',
    tokens: {
      // Mock token addresses on devnet (update after deployment)
      USDC:
        process.env.SOLANA_DEVNET_USDC || '11111111111111111111111111111111',
      USDT:
        process.env.SOLANA_DEVNET_USDT || '11111111111111111111111111111111',
      PYUSD:
        process.env.SOLANA_DEVNET_PYUSD || '11111111111111111111111111111111',
    },
  },
};

/**
 * RPC URLs for each network
 */
export const RPC_URLS: Record<NetworkType, string> = {
  // Testnets
  [NetworkType.SEPOLIA]: process.env.ETHEREUM_SEPOLIA_RPC_URL || '',
  [NetworkType.MUMBAI]: process.env.POLYGON_MUMBAI_RPC_URL || '',
  [NetworkType.BSC_TESTNET]:
    process.env.BSC_TESTNET_RPC_URL ||
    'https://data-seed-prebsc-1-s1.binance.org:8545',
  [NetworkType.ARBITRUM_SEPOLIA]: process.env.ARBITRUM_SEPOLIA_RPC_URL || '',
  [NetworkType.OPTIMISM_SEPOLIA]: process.env.OPTIMISM_SEPOLIA_RPC_URL || '',
  [NetworkType.AVALANCHE_FUJI]:
    process.env.AVALANCHE_FUJI_RPC_URL ||
    'https://api.avax-test.network/ext/bc/C/rpc',
  [NetworkType.BASE_SEPOLIA]: process.env.BASE_SEPOLIA_RPC_URL || '',
  [NetworkType.SOLANA_DEVNET]:
    process.env.SOLANA_DEVNET_RPC_URL || 'https://api.devnet.solana.com',

  // Mainnets
  [NetworkType.ETHEREUM]: process.env.ETHEREUM_RPC_URL || '',
  [NetworkType.POLYGON]: process.env.POLYGON_RPC_URL || '',
  [NetworkType.BSC]: process.env.BSC_RPC_URL || '',
  [NetworkType.ARBITRUM]: process.env.ARBITRUM_RPC_URL || '',
  [NetworkType.OPTIMISM]: process.env.OPTIMISM_RPC_URL || '',
  [NetworkType.AVALANCHE]: process.env.AVALANCHE_RPC_URL || '',
  [NetworkType.BASE]: process.env.BASE_RPC_URL || '',
  [NetworkType.SOLANA]:
    process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
};

/**
 * Get contract address for a specific network
 */
export function getContractAddress(
  network: NetworkType,
): ContractAddresses | null {
  return EVM_CONTRACT_ADDRESSES[network];
}

/**
 * Get RPC URL for a specific network
 */
export function getRpcUrl(network: NetworkType): string {
  return RPC_URLS[network];
}

/**
 * Check if network is EVM-based
 */
export function isEvmNetwork(network: NetworkType): boolean {
  return (
    network !== NetworkType.SOLANA && network !== NetworkType.SOLANA_DEVNET
  );
}

/**
 * Check if network is Solana-based
 */
export function isSolanaNetwork(network: NetworkType): boolean {
  return (
    network === NetworkType.SOLANA || network === NetworkType.SOLANA_DEVNET
  );
}
