/**
 * Add Supported Tokens to TON Payment Contract
 *
 * This script adds jetton (token) addresses to the payment contract's
 * supported tokens list.
 *
 * Usage:
 * ts-node scripts/add-tokens.ts --network=testnet
 */

import { TonClient, WalletContractV4, Address, beginCell, toNano } from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';
import * as fs from 'fs';
import * as path from 'path';

// Network configuration
const NETWORKS = {
  testnet: 'https://testnet.toncenter.com/api/v2/jsonRPC',
  mainnet: 'https://toncenter.com/api/v2/jsonRPC',
};

// Jetton master contract addresses for different networks
// These are the main token contract addresses (not wallet addresses)
const JETTON_ADDRESSES = {
  // TON Testnet
  testnet: {
    USDT: 'EQC...',  // Update with actual testnet addresses
    USDC: 'EQC...',
    DAI: 'EQC...',
    BUSD: 'EQC...',
  },
  // TON Mainnet
  mainnet: {
    USDT: 'EQC...',  // jUSDT jetton master
    USDC: 'EQC...',  // jUSDC jetton master
    DAI: 'EQC...',
    BUSD: 'EQC...',
  },
};

async function addTokens() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const networkArg = args.find(arg => arg.startsWith('--network='));
  const network = networkArg ? networkArg.split('=')[1] as keyof typeof NETWORKS : 'testnet';

  console.log(`\n🪙 Adding supported tokens on TON ${network}...\n`);

  // Load deployment info
  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  const filename = `${network}.json`;
  const filepath = path.join(deploymentsDir, filename);

  if (!fs.existsSync(filepath)) {
    throw new Error(`Deployment file not found: ${filepath}\nPlease deploy the contract first.`);
  }

  const deploymentInfo = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  const { contractAddress } = deploymentInfo;

  console.log('Contract Address:', contractAddress, '\n');

  // Get admin mnemonic from environment
  const mnemonicStr = process.env.TON_ADMIN_MNEMONIC || process.env.TON_DEPLOYER_MNEMONIC;
  if (!mnemonicStr) {
    throw new Error('TON_ADMIN_MNEMONIC or TON_DEPLOYER_MNEMONIC environment variable not set');
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
  const adminAddress = wallet.address.toString();
  console.log('Admin Address:', adminAddress, '\n');

  // Get jetton addresses for this network
  const jettons = JETTON_ADDRESSES[network];
  if (!jettons) {
    console.log('⚠️  No jetton addresses configured for network:', network);
    console.log('Please update JETTON_ADDRESSES in this script and try again.');
    return;
  }

  // Add each jetton
  for (const [symbol, address] of Object.entries(jettons)) {
    if (!address || address.startsWith('EQC...')) {
      console.log(`⏭️  Skipping ${symbol} (no address configured)`);
      continue;
    }

    try {
      console.log(`Adding ${symbol}: ${address}`);

      // Build message to add supported token
      // Format: op::add_supported_token query_id:uint64 token_address:MsgAddress
      const body = beginCell()
        .storeUint(0x4e565354, 32)  // op code for AddSupportedToken
        .storeUint(0, 64)            // query_id
        .storeAddress(Address.parse(address))
        .endCell();

      // Send message to contract
      await walletContract.sendTransfer({
        seqno: await walletContract.getSeqno(),
        secretKey: keyPair.secretKey,
        messages: [
          {
            to: Address.parse(contractAddress),
            value: toNano('0.05'), // Gas fee
            body,
          },
        ],
      });

      console.log(`✅ ${symbol} transaction sent\n`);

      // Wait a bit between transactions
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error: any) {
      console.error(`❌ Failed to add ${symbol}:`, error.message, '\n');
    }
  }

  console.log('✨ Token configuration complete!\n');

  // Note: To verify tokens, you would need to query the contract state
  console.log('ℹ️  Wait a few seconds for transactions to confirm, then verify via explorer:');
  console.log(`https://${network === 'testnet' ? 'testnet.' : ''}tonviewer.com/${contractAddress}`);
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
