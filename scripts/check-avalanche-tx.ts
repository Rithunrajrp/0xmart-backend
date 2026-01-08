import { ethers } from 'ethers';

const TX_HASH = '0xbb4d6b34e0367a75ec4e02ff7a82fadfd65826bfe2d237a1f2193cf0d6868926';
const RPC_URL = 'https://api.avax-test.network/ext/bc/C/rpc';

async function checkTransaction() {
  console.log('🔍 Checking transaction details...\n');

  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);

  // Get transaction
  const tx = await provider.getTransaction(TX_HASH);
  console.log('📄 Transaction:');
  console.log(`   From: ${tx.from}`);
  console.log(`   To: ${tx.to}`);
  console.log(`   Value: ${ethers.utils.formatEther(tx.value)} AVAX`);
  console.log(`   Data: ${tx.data}`);
  console.log(`   Gas: ${tx.gasLimit.toString()}\n`);

  // Get receipt
  const receipt = await provider.getTransactionReceipt(TX_HASH);
  console.log('📝 Receipt:');
  console.log(`   Status: ${receipt.status === 1 ? 'Success' : 'Failed'}`);
  console.log(`   Block: ${receipt.blockNumber}`);
  console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
  console.log(`   Logs: ${receipt.logs.length}\n`);

  // Print all logs
  console.log('📋 Logs:');
  receipt.logs.forEach((log, i) => {
    console.log(`\nLog ${i}:`);
    console.log(`   Address: ${log.address}`);
    console.log(`   Topics: ${log.topics.join(', ')}`);
    console.log(`   Data: ${log.data}`);
  });
}

checkTransaction()
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
