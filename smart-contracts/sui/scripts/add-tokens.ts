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
  // Sui Testnet - Use test tokens deployed on testnet
  testnet: {
    USDT: process.env.SUI_TESTNET_USDT_ADDRESS || '0x...::usdt::USDT', // Deploy test tokens first
    USDC: process.env.SUI_TESTNET_USDC_ADDRESS || '0x...::usdc::USDC',
    DAI: process.env.SUI_TESTNET_DAI_ADDRESS || '0x...::dai::DAI',
    BUSD: process.env.SUI_TESTNET_BUSD_ADDRESS || '0x...::busd::BUSD',
  },
  // Sui Mainnet - Official stablecoin addresses
  mainnet: {
    // Official USDC from Circle on Sui Mainnet
    USDC: process.env.SUI_MAINNET_USDC_ADDRESS || '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN',
    // Official USDT (Tether) on Sui Mainnet
    USDT: process.env.SUI_MAINNET_USDT_ADDRESS || '0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab08c::coin::COIN',
    // DAI and BUSD - Use official addresses from environment
    DAI: process.env.SUI_MAINNET_DAI_ADDRESS || '0x0000000000000000000000000000000000000000::dai::DAI',
    BUSD: process.env.SUI_MAINNET_BUSD_ADDRESS || '0x0000000000000000000000000000000000000000::busd::BUSD',
  },
  // Sui Devnet - Use devnet test tokens
  devnet: {
    USDT: process.env.SUI_DEVNET_USDT_ADDRESS || '0x...::usdt::USDT',
    USDC: process.env.SUI_DEVNET_USDC_ADDRESS || '0x...::usdc::USDC',
    DAI: process.env.SUI_DEVNET_DAI_ADDRESS || '0x...::dai::DAI',
    BUSD: process.env.SUI_DEVNET_BUSD_ADDRESS || '0x...::busd::BUSD',
  },
  // Local testing - Deploy mock tokens locally
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
