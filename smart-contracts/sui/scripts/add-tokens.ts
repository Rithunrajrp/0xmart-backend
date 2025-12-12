/**
 * Add Supported Tokens to Sui Payment Contract
 *
 * This script adds stablecoin token types to the payment contract's
 * supported tokens list.
 *
 * Usage:
 * ts-node scripts/add-tokens.ts --network=testnet
 */

import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { fromB64 } from '@mysten/sui.js/utils';
import * as fs from 'fs';
import * as path from 'path';

// Network configuration
const NETWORKS = {
  localnet: getFullnodeUrl('localnet'),
  devnet: getFullnodeUrl('devnet'),
  testnet: getFullnodeUrl('testnet'),
  mainnet: getFullnodeUrl('mainnet'),
};

// Token type configurations for different networks
// Format: module_address::module_name::CoinType
const TOKEN_TYPES = {
  // Sui Testnet
  testnet: {
    USDT: '0x...::usdt::USDT', // Update with actual testnet addresses
    USDC: '0x...::usdc::USDC',
    DAI: '0x...::dai::DAI',
    BUSD: '0x...::busd::BUSD',
  },
  // Sui Mainnet
  mainnet: {
    USDT: '0x...::usdt::USDT', // Update with actual mainnet addresses
    USDC: '0x...::usdc::USDC',
    DAI: '0x...::dai::DAI',
    BUSD: '0x...::busd::BUSD',
  },
  // Sui Devnet
  devnet: {
    USDT: '0x...::usdt::USDT',
    USDC: '0x...::usdc::USDC',
    DAI: '0x...::dai::DAI',
    BUSD: '0x...::busd::BUSD',
  },
  // Local testing
  localnet: {
    USDT: '0x...::usdt::USDT',
    USDC: '0x...::usdc::USDC',
    DAI: '0x...::dai::DAI',
    BUSD: '0x...::busd::BUSD',
  },
};

async function addTokens() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const networkArg = args.find(arg => arg.startsWith('--network='));
  const network = networkArg ? networkArg.split('=')[1] as keyof typeof NETWORKS : 'testnet';

  console.log(`\n🪙 Adding supported tokens on ${network}...\n`);

  // Load deployment info
  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  const filename = `${network}.json`;
  const filepath = path.join(deploymentsDir, filename);

  if (!fs.existsSync(filepath)) {
    throw new Error(`Deployment file not found: ${filepath}\nPlease deploy the contract first.`);
  }

  const deploymentInfo = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  const { packageId, configObjectId } = deploymentInfo;

  console.log('Package ID:', packageId);
  console.log('Config Object ID:', configObjectId, '\n');

  // Get admin keypair from environment
  const privateKeyB64 = process.env.SUI_ADMIN_PRIVATE_KEY || process.env.SUI_DEPLOYER_PRIVATE_KEY;
  if (!privateKeyB64) {
    throw new Error('SUI_ADMIN_PRIVATE_KEY or SUI_DEPLOYER_PRIVATE_KEY environment variable not set');
  }

  const keypair = Ed25519Keypair.fromSecretKey(fromB64(privateKeyB64));
  const adminAddress = keypair.getPublicKey().toSuiAddress();
  console.log('Admin Address:', adminAddress, '\n');

  // Initialize Sui client
  const client = new SuiClient({ url: NETWORKS[network] });

  // Get token types for this network
  const tokens = TOKEN_TYPES[network];
  if (!tokens) {
    console.log('⚠️  No token types configured for network:', network);
    console.log('Please update TOKEN_TYPES in this script and try again.');
    return;
  }

  // Add each token
  for (const [symbol, tokenType] of Object.entries(tokens)) {
    if (!tokenType || tokenType.includes('0x...')) {
      console.log(`⏭️  Skipping ${symbol} (no type configured)`);
      continue;
    }

    try {
      console.log(`Adding ${symbol}: ${tokenType}`);

      // Create transaction block
      const tx = new TransactionBlock();

      // Call add_supported_token with the token type as generic parameter
      tx.moveCall({
        target: `${packageId}::payment::add_supported_token`,
        typeArguments: [tokenType],
        arguments: [tx.object(configObjectId)],
      });

      // Sign and execute transaction
      const result = await client.signAndExecuteTransactionBlock({
        signer: keypair,
        transactionBlock: tx,
        options: {
          showEffects: true,
          showEvents: true,
        },
      });

      console.log('Transaction digest:', result.digest);

      if (result.effects?.status?.status === 'success') {
        console.log(`✅ ${symbol} added successfully\n`);
      } else {
        console.error(`❌ Failed to add ${symbol}:`, result.effects?.status);
      }
    } catch (error: any) {
      console.error(`❌ Failed to add ${symbol}:`, error.message, '\n');
    }
  }

  console.log('✨ Token configuration complete!\n');

  // Note: To verify tokens, you would need to query the contract state
  console.log('ℹ️  To verify supported tokens, query the contract state:');
  console.log(`sui client object ${configObjectId}`);
}

// Main execution
addTokens()
  .then(() => {
    console.log('Token addition process completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Token addition failed:', error);
    process.exit(1);
  });
