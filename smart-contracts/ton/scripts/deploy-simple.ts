import { TonClient, WalletContractV4, Address, toNano, fromNano } from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { OxMartPayment } from '../build/oxmart_payment_OxMartPayment';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function deploy() {
  console.log('\n🚀 Deploying OxMart Payment Contract to TON Testnet...\n');

  // Get environment variables
  const hotWalletAddress = process.env.TON_HOT_WALLET_ADDRESS;
  const mnemonicStr = process.env.TON_DEPLOYER_MNEMONIC;

  if (!hotWalletAddress || !mnemonicStr) {
    throw new Error('Missing TON_HOT_WALLET_ADDRESS or TON_DEPLOYER_MNEMONIC in .env');
  }

  console.log('Hot Wallet Address:', hotWalletAddress);

  // Parse mnemonic
  const mnemonic = mnemonicStr.split(' ');
  const keyPair = await mnemonicToPrivateKey(mnemonic);

  // Initialize TON client
  const client = new TonClient({
    endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
    apiKey: process.env.TONCENTER_API_KEY || '',
  });

  // Create deployer wallet
  const wallet = WalletContractV4.create({
    workchain: 0,
    publicKey: keyPair.publicKey,
  });

  const walletContract = client.open(wallet);
  const deployerAddress = wallet.address.toString();

  console.log('Deployer Address:', deployerAddress);

  // Check balance
  const balance = await walletContract.getBalance();
  console.log('Deployer Balance:', fromNano(balance), 'TON\n');

  if (Number(fromNano(balance)) < 0.5) {
    console.warn('⚠️  Warning: Low balance. You need at least 0.5 TON for deployment.');
    console.warn('Get testnet TON from: https://t.me/testgiver_ton_bot');
    console.warn('Send your address: ' + deployerAddress);
    return;
  }

  // Prepare contract
  const hotWallet = Address.parse(hotWalletAddress);
  const contract = client.open(await OxMartPayment.fromInit(hotWallet));
  const contractAddress = contract.address.toString();

  console.log('Contract Address (to be deployed):', contractAddress);

  // Check if already deployed
  const isDeployed = await client.isContractDeployed(contract.address);
  if (isDeployed) {
    console.log('\n✅ Contract is already deployed!');
    console.log('Contract Address:', contractAddress);
    return contractAddress;
  }

  console.log('\n📤 Deploying contract...');

  // Deploy the contract
  await contract.send(
    walletContract.sender(keyPair.secretKey),
    {
      value: toNano('0.5'), // Deployment fee
    },
    {
      $$type: 'Deploy',
      queryId: 0n,
    }
  );

  console.log('⏳ Waiting for deployment confirmation (this may take 10-30 seconds)...\n');

  // Wait for deployment
  let attempts = 0;
  const maxAttempts = 30;

  while (attempts < maxAttempts) {
    const deployed = await client.isContractDeployed(contract.address);
    if (deployed) {
      console.log('✅ Contract successfully deployed!\n');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('Contract Address:', contractAddress);
      console.log('Network: Testnet');
      console.log('Explorer: https://testnet.tonviewer.com/' + contractAddress);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      // Save deployment info
      const deploymentInfo = {
        network: 'testnet',
        contractAddress,
        hotWalletAddress,
        deployer: deployerAddress,
        deploymentTime: new Date().toISOString(),
      };

      const deploymentsDir = path.join(__dirname, '..', 'deployments');
      if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
      }

      fs.writeFileSync(
        path.join(deploymentsDir, 'testnet.json'),
        JSON.stringify(deploymentInfo, null, 2)
      );

      console.log('💾 Deployment info saved to deployments/testnet.json\n');
      console.log('📝 Next Steps:');
      console.log('1. Update .env file with: TON_CONTRACT_ADDRESS=' + contractAddress);
      console.log('2. Add supported tokens: npm run add-tokens:testnet');
      console.log('3. Test the contract on https://testnet.tonviewer.com/' + contractAddress + '\n');

      return contractAddress;
    }

    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    attempts++;
    process.stdout.write('.');
  }

  throw new Error('Deployment timeout - contract not confirmed after 60 seconds');
}

// Run deployment
deploy()
  .then((address) => {
    if (address) {
      console.log('\n✨ Deployment complete!');
      process.exit(0);
    }
  })
  .catch((error) => {
    console.error('\n❌ Deployment failed:', error);
    process.exit(1);
  });
