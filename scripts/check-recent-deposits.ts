import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';

const prisma = new PrismaClient();

const AVALANCHE_RPC = 'https://api.avax-test.network/ext/bc/C/rpc';
const USDC_ADDRESS = '0x5425890298aed601595a70AB815c96711a31Bc65';

const ERC20_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)',
];

async function checkRecentDeposits() {
  console.log('🔍 Checking recent Avalanche USDC deposits...\n');

  // Get user's Avalanche USDC wallet
  const user = await prisma.user.findFirst({
    where: { email: 'rithunravi@gmail.com' },
  });

  if (!user) {
    console.log('❌ User not found!');
    return;
  }

  const wallet = await prisma.wallet.findFirst({
    where: {
      userId: user.id,
      network: 'AVALANCHE',
      stablecoinType: 'USDC',
    },
  });

  if (!wallet) {
    console.log('❌ Avalanche USDC wallet not found!');
    return;
  }

  console.log(`✅ Wallet found:`);
  console.log(`   Address: ${wallet.depositAddress}`);
  console.log(`   Current balance: $${wallet.balance}\n`);

  // Connect to Avalanche
  const provider = new ethers.providers.JsonRpcProvider(AVALANCHE_RPC);
  const currentBlock = await provider.getBlockNumber();
  console.log(`📊 Current block: ${currentBlock}\n`);

  // Get recent deposits from database
  const dbDeposits = await prisma.deposit.findMany({
    where: {
      walletId: wallet.id,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 5,
  });

  console.log(`📋 Recent deposits in database: ${dbDeposits.length}`);
  dbDeposits.forEach((d) => {
    console.log(`   ${d.txHash} - $${d.amount} - ${d.status}`);
  });
  console.log();

  // Check blockchain for recent transfers
  console.log(`🔎 Scanning blockchain for recent transfers...`);
  console.log(`   Looking back 1000 blocks from ${currentBlock}\n`);

  const contract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, provider);
  const depositAddress = wallet.depositAddress.toLowerCase();

  const filter = {
    address: USDC_ADDRESS,
    topics: [
      ethers.utils.id('Transfer(address,address,uint256)'),
      null,
      ethers.utils.hexZeroPad(depositAddress, 32),
    ],
    fromBlock: currentBlock - 1000,
    toBlock: 'latest',
  };

  const logs = await provider.getLogs(filter);
  console.log(`📝 Found ${logs.length} transfer events on blockchain:\n`);

  for (const log of logs) {
    const parsedLog = contract.interface.parseLog(log);
    const from = parsedLog.args.from;
    const amount = ethers.utils.formatUnits(parsedLog.args.value, 6);
    const txHash = log.transactionHash;

    console.log(`💸 Transfer:`);
    console.log(`   TX: ${txHash}`);
    console.log(`   From: ${from}`);
    console.log(`   Amount: ${amount} USDC`);
    console.log(`   Block: ${log.blockNumber}`);

    // Check if in database
    const inDb = dbDeposits.find((d) => d.txHash === txHash);
    if (inDb) {
      console.log(`   ✅ In database - Status: ${inDb.status}`);
    } else {
      console.log(`   ❌ NOT in database - MISSING!`);
      console.log(`   ⚠️  This deposit was not detected!\n`);
      console.log(`   To process manually, run:`);
      console.log(`   TX_HASH='${txHash}' npx ts-node scripts/manual-deposit-process.ts\n`);
    }
    console.log();
  }

  console.log('✨ Done!');
}

checkRecentDeposits()
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
