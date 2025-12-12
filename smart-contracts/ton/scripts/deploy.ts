/**
 * TON Deployment Script for OxMart Payment Contract
 *
 * This script compiles and deploys the payment processing contract to TON network
 * and initializes it with a hot wallet address.
 *
 * Usage:
 * ts-node scripts/deploy.ts --network=testnet
 */

import { TonClient, WalletContractV4, Address, toNano, fromNano } from '@ton/ton';
import { mnemonicToPrivateKey, mnemonicNew } from '@ton/crypto';
import * as fs from 'fs';
import * as path from 'path';

// Network configuration
const NETWORKS = {
  testnet: 'https://testnet.toncenter.com/api/v2/jsonRPC',
  mainnet: 'https://toncenter.com/api/v2/jsonRPC',
};

interface DeploymentInfo {
  network: string;
  contractAddress: string;
  hotWalletAddress: string;
  deployer: string;
  deploymentTime: string;
  initHash: string;
}

async function deploy() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const networkArg = args.find(arg => arg.startsWith('--network='));
  const network = networkArg ? networkArg.split('=')[1] as keyof typeof NETWORKS : 'testnet';

  console.log(`\n🚀 Starting deployment to TON ${network}...\n`);

  // Get hot wallet address from environment
  const hotWalletAddress = process.env.TON_HOT_WALLET_ADDRESS;
  if (!hotWalletAddress) {
    throw new Error('TON_HOT_WALLET_ADDRESS environment variable not set');
  }

  console.log('Hot Wallet Address:', hotWalletAddress);

  // Get deployer mnemonic from environment
  const mnemonicStr = process.env.TON_DEPLOYER_MNEMONIC;
  if (!mnemonicStr) {
    console.log('\n⚠️  TON_DEPLOYER_MNEMONIC not set. Generating new wallet...\n');
    const newMnemonic = await mnemonicNew(24);
    console.log('🔑 New Mnemonic (SAVE THIS SECURELY):');
    console.log(newMnemonic.join(' '));
    console.log('\nAdd this to your .env file:');
    console.log(`TON_DEPLOYER_MNEMONIC="${newMnemonic.join(' ')}"`);
    console.log('\nFund this wallet and run deployment again.\n');
    return;
  }

  const mnemonic = mnemonicStr.split(' ');
  const keyPair = await mnemonicToPrivateKey(mnemonic);

  // Initialize TON client
  const endpoint = NETWORKS[network];
  const apiKey = process.env.TONCENTER_API_KEY || '';

  const client = new TonClient({
    endpoint,
    apiKey,
  });

  // Create wallet
  const wallet = WalletContractV4.create({
    workchain: 0,
    publicKey: keyPair.publicKey,
  });

  const walletContract = client.open(wallet);
  const deployerAddress = wallet.address.toString();
  console.log('Deployer Address:', deployerAddress);

  // Check balance
  try {
    const balance = await walletContract.getBalance();
    console.log('Deployer Balance:', fromNano(balance), 'TON\n');

    if (Number(fromNano(balance)) < 1) {
      console.warn('⚠️  Warning: Low balance. You need at least 1 TON for deployment.');
      if (network === 'testnet') {
        console.warn('Get testnet TON from: https://t.me/testgiver_ton_bot');
      }
      return;
    }
  } catch (error) {
    console.error('❌ Failed to get balance. Wallet may not be deployed yet.');
    console.error('For testnet, get TON from: https://t.me/testgiver_ton_bot');
    throw error;
  }

  // Build contract
  console.log('📦 Building contract...\n');
  console.log('Make sure you have run: npm run build\n');

  // Check if build output exists
  const buildPath = path.join(__dirname, '..', 'build', 'oxmart_payment.ts');
  if (!fs.existsSync(buildPath)) {
    console.error('❌ Build output not found. Run: npm run build');
    return;
  }

  console.log('✅ Build output found\n');

  try {
    // Import the compiled contract
    // Note: The actual deployment would use the compiled contract code
    // This is a placeholder - actual implementation depends on Tact output

    console.log('⚠️  DEPLOYMENT STEPS:\n');
    console.log('1. Build the contract:');
    console.log('   npm run build\n');
    console.log('2. The build will generate deployment code in ./build/');
    console.log('3. Deploy using the generated code with the following init data:');
    console.log(`   - Hot Wallet: ${hotWalletAddress}`);
    console.log('4. After deployment, note the contract address');
    console.log('5. Set TON_CONTRACT_ADDRESS in .env\n');

    // Placeholder for contract address - update after manual deployment
    const contractAddress = process.env.TON_CONTRACT_ADDRESS || 'UPDATE_AFTER_DEPLOYMENT';

    if (contractAddress === 'UPDATE_AFTER_DEPLOYMENT') {
      console.log('ℹ️  After deployment, set this environment variable:');
      console.log('   TON_CONTRACT_ADDRESS=<contract_address_from_deployment>');
      console.log('\nThen run this script again to save deployment info.\n');
      return;
    }

    // Save deployment info
    const deploymentInfo: DeploymentInfo = {
      network,
      contractAddress,
      hotWalletAddress,
      deployer: deployerAddress,
      deploymentTime: new Date().toISOString(),
      initHash: 'N/A', // Will be available after actual deployment
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
