import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Check if contract is deployed (not zero address)
function isContractDeployed(address: string | undefined): boolean {
  return !!address && address !== '0x0000000000000000000000000000000000000000';
}

// Get contract addresses from environment
const contractAddresses = {
  ETHEREUM: process.env.ETHEREUM_SEPOLIA_CONTRACT_ADDRESS || process.env.ETHEREUM_CONTRACT_ADDRESS,
  POLYGON: process.env.POLYGON_AMOY_CONTRACT_ADDRESS || process.env.POLYGON_CONTRACT_ADDRESS,
  BSC: process.env.BSC_TESTNET_CONTRACT_ADDRESS || process.env.BSC_CONTRACT_ADDRESS,
  ARBITRUM: process.env.ARBITRUM_SEPOLIA_CONTRACT_ADDRESS || process.env.ARBITRUM_CONTRACT_ADDRESS,
  OPTIMISM: process.env.OPTIMISM_SEPOLIA_CONTRACT_ADDRESS || process.env.OPTIMISM_CONTRACT_ADDRESS,
  AVALANCHE: process.env.AVALANCHE_FUJI_CONTRACT_ADDRESS || process.env.AVALANCHE_CONTRACT_ADDRESS,
  BASE: process.env.BASE_SEPOLIA_CONTRACT_ADDRESS || process.env.BASE_CONTRACT_ADDRESS,
  SUI: process.env.SUI_PACKAGE_ID,
  TON: process.env.TON_CONTRACT_ADDRESS,
  SOLANA: process.env.SOLANA_PROGRAM_ID,
};

const networkMetadata = {
  ETHEREUM: {
    displayName: 'Ethereum',
    description: 'Ethereum Mainnet - The most widely adopted smart contract platform',
    sortOrder: 1,
  },
  POLYGON: {
    displayName: 'Polygon',
    description: 'Polygon (Matic) - Fast and low-cost Ethereum sidechain',
    sortOrder: 2,
  },
  BSC: {
    displayName: 'BNB Smart Chain',
    description: 'BNB Smart Chain - High-performance blockchain by Binance',
    sortOrder: 3,
  },
  ARBITRUM: {
    displayName: 'Arbitrum',
    description: 'Arbitrum One - Layer 2 scaling solution for Ethereum',
    sortOrder: 4,
  },
  OPTIMISM: {
    displayName: 'Optimism',
    description: 'Optimism - Ethereum Layer 2 with optimistic rollups',
    sortOrder: 5,
  },
  AVALANCHE: {
    displayName: 'Avalanche',
    description: 'Avalanche C-Chain - Fast, low-cost, and eco-friendly blockchain',
    sortOrder: 6,
  },
  BASE: {
    displayName: 'Base',
    description: 'Base - Layer 2 network built by Coinbase',
    sortOrder: 7,
  },
  SUI: {
    displayName: 'Sui',
    description: 'Sui Network - Next-generation smart contract platform',
    sortOrder: 8,
  },
  TON: {
    displayName: 'TON',
    description: 'The Open Network - High-performance blockchain by Telegram',
    sortOrder: 9,
  },
  SOLANA: {
    displayName: 'Solana',
    description: 'Solana - Ultra-fast blockchain with low transaction costs',
    sortOrder: 10,
  },
};

async function initializeNetworks() {
  console.log('Starting network initialization...');

  for (const [network, metadata] of Object.entries(networkMetadata)) {
    try {
      const existing = await prisma.networkConfig.findUnique({
        where: { network: network as any },
      });

      const contractAddress = contractAddresses[network];
      const contractDeployed = isContractDeployed(contractAddress);

      if (existing) {
        // Update contract deployment status
        await prisma.networkConfig.update({
          where: { network: network as any },
          data: {
            contractDeployed,
            contractAddress: contractDeployed ? contractAddress : null,
            lastContractCheck: new Date(),
          },
        });
        console.log(`✓ Updated network: ${network} (Contract: ${contractDeployed ? 'Deployed' : 'Pending'})`);
      } else {
        await prisma.networkConfig.create({
          data: {
            network: network as any,
            isEnabled: true,
            displayName: metadata.displayName,
            description: metadata.description,
            sortOrder: metadata.sortOrder,
            contractDeployed,
            contractAddress: contractDeployed ? contractAddress : null,
            lastContractCheck: new Date(),
          },
        });
        console.log(`✓ Initialized network: ${network} (Contract: ${contractDeployed ? 'Deployed' : 'Pending'})`);
      }
    } catch (error) {
      console.error(`✗ Failed to initialize network ${network}:`, error);
    }
  }

  console.log('Network initialization completed!');
}

initializeNetworks()
  .catch((error) => {
    console.error('Fatal error during initialization:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
