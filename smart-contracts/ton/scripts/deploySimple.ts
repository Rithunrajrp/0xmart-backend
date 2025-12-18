/**
 * Simple TON Deployment Script for OxMart Payment Contract
 * Deploys the contract using the generated Tact bindings
 */

import { TonClient, WalletContractV4, Address, toNano, fromNano, internal } from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { OxMartPayment } from '../build/oxmart_payment_OxMartPayment';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../.env') });

async function deploy() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('   🚀 TON Contract Deployment - 0xMart Payment');
  console.log('═══════════════════════════════════════════════════════\n');

  // Get configuration from environment
  const mnemonicStr = process.env.TON_DEPLOYER_MNEMONIC;
  const hotWalletStr = process.env.TON_HOT_WALLET_ADDRESS;

  if (!mnemonicStr) {
    throw new Error('TON_DEPLOYER_MNEMONIC not set in .env file');
  }

  if (!hotWalletStr) {
    throw new Error('TON_HOT_WALLET_ADDRESS not set in .env file');
  }

  const mnemonic = mnemonicStr.split(' ');
  const hotWalletAddress = Address.parse(hotWalletStr);

  console.log('📍 Configuration');
  console.log('─────────────────────────────────────────────────────────');
  console.log(`Hot Wallet: ${hotWalletAddress.toString()}`);
  console.log('');

  // Initialize TON client (testnet)
  const client = new TonClient({
    endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
  });

  // Prepare deployer wallet
  const keyPair = await mnemonicToPrivateKey(mnemonic);
  const wallet = WalletContractV4.create({
    workchain: 0,
    publicKey: keyPair.publicKey,
  });

  const walletContract = client.open(wallet);
  const deployerAddress = wallet.address.toString();

  console.log('👤 Deployer Wallet');
  console.log('─────────────────────────────────────────────────────────');
  console.log(`Address: ${deployerAddress}`);

  // Check balance
  try {
    const balance = await walletContract.getBalance();
    const balanceTON = fromNano(balance);
    console.log(`Balance: ${balanceTON} TON`);

    if (Number(balanceTON) < 0.5) {
      console.log('\n⚠️  Warning: Low balance!');
      console.log('You need at least 0.5 TON for deployment.');
      console.log('Get testnet TON from: https://t.me/testgiver_ton_bot');
      return;
    }
  } catch (error) {
    console.error('\n❌ Failed to get balance:', error);
    console.log('Make sure the wallet has been deployed and funded.');
    console.log('Get testnet TON from: https://t.me/testgiver_ton_bot');
    return;
  }

  console.log('');

  //  Prepare contract for deployment
  console.log('📦 Preparing Contract');
  console.log('─────────────────────────────────────────────────────────');

  const contract = await OxMartPayment.fromInit(hotWalletAddress);
  const contractAddress = contract.address;

  console.log(`Contract Address: ${contractAddress.toString()}`);
  console.log('');

  // Deploy the contract
  console.log('🚀 Deploying Contract...');
  console.log('─────────────────────────────────────────────────────────');

  const seqno = await walletContract.getSeqno();

  await walletContract.sendTransfer({
    seqno,
    secretKey: keyPair.secretKey,
    messages: [
      internal({
        to: contractAddress,
        value: toNano('0.1'), // Initial contract balance
        init: {
          code: contract.init!.code,
          data: contract.init!.data,
        },
        bounce: false,
      }),
    ],
  });

  console.log('✅ Deployment transaction sent!');
  console.log('Waiting for confirmation...\n');

  // Wait for deployment
  let attempt = 0;
  let deployed = false;

  while (attempt < 30 && !deployed) {
    await new Promise(resolve => setTimeout(resolve, 3000));
    attempt++;

    try {
      const state = await client.getContractState(contractAddress);
      if (state.state === 'active') {
        deployed = true;
        console.log('✅ Contract deployed successfully!\n');
      } else {
        process.stdout.write(`⏳ Waiting for deployment... (${attempt}/30)\r`);
      }
    } catch (e) {
      // Contract not yet deployed
      process.stdout.write(`⏳ Waiting for deployment... (${attempt}/30)\r`);
    }
  }

  if (!deployed) {
    console.log('\n⚠️  Deployment timeout. The contract may still be deploying.');
    console.log('Check the contract address on the explorer:');
    console.log(`https://testnet.tonviewer.com/${contractAddress.toString()}`);
    console.log('');
  }

  // Save deployment info
  console.log('📝 Saving Deployment Information');
  console.log('─────────────────────────────────────────────────────────');

  const deploymentInfo = {
    network: 'testnet',
    contractAddress: contractAddress.toString({ testOnly: true }),
    contractAddressMainnet: contractAddress.toString({ testOnly: false }),
    hotWalletAddress: hotWalletAddress.toString({ testOnly: true }),
    deployer: deployerAddress,
    deploymentTime: new Date().toISOString(),
    explorer: `https://testnet.tonviewer.com/${contractAddress.toString()}`,
  };

  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const filepath = path.join(deploymentsDir, 'testnet.json');
  fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));

  console.log(`Saved to: ${filepath}\n`);

  // Print summary
  console.log('═══════════════════════════════════════════════════════');
  console.log('   ✨ Deployment Complete!');
  console.log('═══════════════════════════════════════════════════════\n');

  console.log('📋 Contract Information:');
  console.log(`   Address (Testnet): ${deploymentInfo.contractAddress}`);
  console.log(`   Explorer: ${deploymentInfo.explorer}`);
  console.log('');

  console.log('📝 Next Steps:');
  console.log('   1. Add this to your .env file:');
  console.log(`      TON_TESTNET_CONTRACT_ADDRESS=${deploymentInfo.contractAddress}`);
  console.log('   2. Add supported tokens using: npm run add-tokens:testnet');
  console.log('   3. Test the contract functions');
  console.log('');
}

deploy()
  .then(() => {
    console.log('Deployment script completed successfully ✓\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Deployment failed:', error);
    process.exit(1);
  });
