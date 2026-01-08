import { NetworkType } from '@prisma/client';

/**
 * Payment Processor Smart Contract Addresses
 * Deploy the same contract to each network
 */
export const PAYMENT_PROCESSOR_ADDRESSES: Record<NetworkType, string> = {
  ETHEREUM: process.env.ETHEREUM_PAYMENT_CONTRACT || '0x0000000000000000000000000000000000000000',
  POLYGON: process.env.POLYGON_PAYMENT_CONTRACT || '0x0000000000000000000000000000000000000000',
  BSC: process.env.BSC_PAYMENT_CONTRACT || '0x0000000000000000000000000000000000000000',
  ARBITRUM: process.env.ARBITRUM_PAYMENT_CONTRACT || '0x0000000000000000000000000000000000000000',
  OPTIMISM: process.env.OPTIMISM_PAYMENT_CONTRACT || '0x0000000000000000000000000000000000000000',
  AVALANCHE: process.env.AVALANCHE_PAYMENT_CONTRACT || '0x0000000000000000000000000000000000000000',
  BASE: process.env.BASE_PAYMENT_CONTRACT || '0x0000000000000000000000000000000000000000',
  SUI: process.env.SUI_PAYMENT_CONTRACT || '0x0000000000000000000000000000000000000000',
  TON: process.env.TON_PAYMENT_CONTRACT || '0x0000000000000000000000000000000000000000',
  SOLANA: process.env.SOLANA_PAYMENT_CONTRACT || '0x0000000000000000000000000000000000000000',
};

/**
 * Stablecoin Token Addresses per Network
 */
export const STABLECOIN_ADDRESSES: Record<
  NetworkType,
  Record<string, string>
> = {
  ETHEREUM: {
    // Using Sepolia testnet tokens for development
    USDT: process.env.SEPOLIA_USDT_ADDRESS || '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06',
    USDC: process.env.SEPOLIA_USDC_ADDRESS || '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    DAI: process.env.SEPOLIA_DAI_ADDRESS || '0x68194a729C2450ad26072b3D33ADaCbcef39D574',
    BUSD: process.env.SEPOLIA_BUSD_ADDRESS || '0x0000000000000000000000000000000000000000',
  },
  POLYGON: {
    USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    DAI: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
    BUSD: '0x9C9e5fD8bbc25984B178FdCE6117Defa39d2db39',
  },
  BSC: {
    USDT: '0x55d398326f99059fF775485246999027B3197955',
    USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    DAI: '0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3',
    BUSD: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
  },
  ARBITRUM: {
    USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    USDC: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
    DAI: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
    BUSD: '0x0000000000000000000000000000000000000000',
  },
  OPTIMISM: {
    USDT: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
    USDC: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
    DAI: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
    BUSD: '0x0000000000000000000000000000000000000000',
  },
  AVALANCHE: {
    USDT: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
    USDC: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    DAI: '0xd586E7F844cEa2F87f50152665BCbc2C279D8d70',
    BUSD: '0x0000000000000000000000000000000000000000',
  },
  BASE: {
    USDT: '0x0000000000000000000000000000000000000000',
    USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    DAI: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
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

/**
 * Payment Processor Contract ABI (OxMartPayment deployed contract)
 */
export const PAYMENT_PROCESSOR_ABI = [
  {
    inputs: [
      { internalType: 'bytes32', name: 'orderId', type: 'bytes32' },
      { internalType: 'address', name: 'token', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
      { internalType: 'string', name: 'productId', type: 'string' },
      { internalType: 'address', name: 'apiKeyOwner', type: 'address' },
      { internalType: 'uint256', name: 'commissionBps', type: 'uint256' },
    ],
    name: 'processPayment',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'bytes32', name: 'orderId', type: 'bytes32' },
      { internalType: 'address', name: 'token', type: 'address' },
      { internalType: 'uint256', name: 'totalAmount', type: 'uint256' },
      { internalType: 'string[]', name: 'productIds', type: 'string[]' },
      { internalType: 'address', name: 'apiKeyOwner', type: 'address' },
      { internalType: 'uint256', name: 'commissionBps', type: 'uint256' },
    ],
    name: 'processBatchPayment',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
    name: 'processedOrders',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'bytes32', name: 'orderId', type: 'bytes32' },
      { indexed: true, internalType: 'address', name: 'buyer', type: 'address' },
      { indexed: true, internalType: 'address', name: 'token', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'amount', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'platformFee', type: 'uint256' },
      { indexed: false, internalType: 'address', name: 'apiKeyOwner', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'commission', type: 'uint256' },
      { indexed: false, internalType: 'string', name: 'productId', type: 'string' },
    ],
    name: 'PaymentReceived',
    type: 'event',
  },
];

/**
 * ERC20 ABI (minimal for approve/transfer)
 */
export const ERC20_ABI = [
  {
    inputs: [
      { internalType: 'address', name: 'spender', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'owner', type: 'address' },
      { internalType: 'address', name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ internalType: 'uint8', name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
];
