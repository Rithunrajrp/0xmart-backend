import { TonClient, Address } from '@ton/ton';
import { OxMartPayment } from '../build/oxmart_payment_OxMartPayment';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function verify() {
  console.log('\n🔍 Verifying OxMart Payment Contract...\n');

  const contractAddress = process.env.TON_CONTRACT_ADDRESS;
  if (!contractAddress) {
    throw new Error('TON_CONTRACT_ADDRESS not set in .env');
  }

  const client = new TonClient({
    endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
  });

  const contract = client.open(OxMartPayment.fromAddress(Address.parse(contractAddress)));

  console.log('Contract Address:', contractAddress);
  console.log('Network: Testnet');
  console.log('Explorer: https://testnet.tonviewer.com/' + contractAddress);
  console.log('');

  // Check if deployed
  const isDeployed = await client.isContractDeployed(Address.parse(contractAddress));
  console.log('✅ Deployed:', isDeployed);

  if (isDeployed) {
    // Get contract state
    try {
      const hotWallet = await contract.getHotWallet();
      const platformFeeBps = await contract.getPlatformFeeBps();
      const isPaused = await contract.getIsPaused();

      console.log('\n📊 Contract State:');
      console.log('   Hot Wallet:', hotWallet.toString());
      console.log('   Platform Fee:', platformFeeBps.toString(), 'bps (', Number(platformFeeBps) / 100, '%)');
      console.log('   Is Paused:', isPaused);

      // Check if a token is supported (example)
      console.log('\n💡 Contract is ready to receive payments!');
      console.log('   Next: Add supported tokens with npm run add-tokens:testnet');
    } catch (error) {
      console.error('\n⚠️  Could not fetch contract state:', error);
    }
  }

  console.log('\n✨ Verification complete!\n');
}

verify()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Verification failed:', error);
    process.exit(1);
  });
