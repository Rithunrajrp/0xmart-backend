/**
 * Sui Deployment Script for OxMart Payment Contract
 *
 * This script deploys the payment processing contract to Sui network
 * and initializes it with a hot wallet address.
 *
 * Usage:
 * pnpm sui client publish --gas-budget 100000000
 *
 * Or use this script:
 * ts-node scripts/deploy.ts --network testnet
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

interface DeploymentInfo {
  network: string;
  packageId: string;
  configObjectId: string;
  hotWalletAddress: string;
  deployer: string;
  deploymentTime: string;
  digest: string;
}

async function deploy() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const networkArg = args.find(arg => arg.startsWith('--network='));
  const network = networkArg ? networkArg.split('=')[1] as keyof typeof NETWORKS : 'testnet';

  console.log(`\n🚀 Starting deployment to ${network}...\n`);

  // Get hot wallet address from environment
  const hotWalletAddress = process.env.SUI_HOT_WALLET_ADDRESS;
  if (!hotWalletAddress) {
    throw new Error('SUI_HOT_WALLET_ADDRESS environment variable not set');
  }

  console.log('Hot Wallet Address:', hotWalletAddress);

  // Get deployer keypair from environment
  const privateKeyB64 = process.env.SUI_DEPLOYER_PRIVATE_KEY;
  if (!privateKeyB64) {
    throw new Error(
      'SUI_DEPLOYER_PRIVATE_KEY environment variable not set\n' +
      'Generate a keypair with: sui client new-address ed25519\n' +
      'Export private key with: sui keytool export --key-identity <address>'
    );
  }

  const keypair = Ed25519Keypair.fromSecretKey(fromB64(privateKeyB64));
  const deployerAddress = keypair.getPublicKey().toSuiAddress();
  console.log('Deployer Address:', deployerAddress);

  // Initialize Sui client
  const client = new SuiClient({ url: NETWORKS[network] });

  // Check deployer balance
  const balance = await client.getBalance({
    owner: deployerAddress,
  });
  console.log('Deployer Balance:', parseInt(balance.totalBalance) / 1e9, 'SUI\n');

  if (parseInt(balance.totalBalance) < 100_000_000) {
    console.warn('⚠️  Warning: Low balance. You may need more SUI for gas fees.');
    console.warn('Request testnet SUI from: https://discord.com/channels/916379725201563759/971488439931392130');
  }

  // Build and publish package
  console.log('📦 Building and publishing package...\n');

  try {
    // Note: For actual deployment, you need to compile the Move code first
    // This can be done with: sui move build
    // Then publish with: sui client publish --gas-budget 100000000

    console.log('⚠️  MANUAL DEPLOYMENT REQUIRED\n');
    console.log('Run the following commands:\n');
    console.log('1. Build the package:');
    console.log('   cd smart-contracts/sui');
    console.log('   sui move build\n');
    console.log('2. Publish the package:');
    console.log('   sui client publish --gas-budget 100000000\n');
    console.log('3. After deployment, note the Package ID and SharedObject ID');
    console.log('4. Update this script with the deployment info\n');

    // For automation, you would parse the output of sui client publish
    // and extract packageId and the created PaymentConfig object ID

    // Placeholder for deployment info - update after manual deployment
    const packageId = process.env.SUI_PACKAGE_ID || 'UPDATE_AFTER_DEPLOYMENT';
    const configObjectId = process.env.SUI_CONFIG_OBJECT_ID || 'UPDATE_AFTER_DEPLOYMENT';

    if (packageId === 'UPDATE_AFTER_DEPLOYMENT') {
      console.log('ℹ️  After deployment, set these environment variables:');
      console.log('   SUI_PACKAGE_ID=<package_id_from_deployment>');
      console.log('   SUI_CONFIG_OBJECT_ID=<config_object_id_from_deployment>');
      console.log('\nThen run this script again to save deployment info.\n');
      return;
    }

    // Save deployment info
    const deploymentInfo: DeploymentInfo = {
      network,
      packageId,
      configObjectId,
      hotWalletAddress,
      deployer: deployerAddress,
      deploymentTime: new Date().toISOString(),
      digest: 'N/A', // Will be available after actual deployment
    };

    const deploymentsDir = path.join(__dirname, '..', 'deployments');
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    const filename = `${network}.json`;
    const filepath = path.join(deploymentsDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));

    console.log('✅ Deployment info saved to:', filepath);

    // Print instructions for adding tokens
    console.log('\n⚠️  IMPORTANT: Add supported tokens after deployment!');
    console.log('Run: ts-node scripts/add-tokens.ts --network=' + network);

    console.log('\n✨ Setup complete!\n');
  } catch (error) {
    console.error('❌ Deployment failed:', error);
    throw error;
  }
}

// Main execution
deploy()
  .then(() => {
    console.log('Deployment process completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Deployment failed:', error);
    process.exit(1);
  });
