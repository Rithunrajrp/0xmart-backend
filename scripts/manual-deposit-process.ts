import { PrismaClient, NetworkType, StablecoinType, TransactionStatus } from '@prisma/client';
import { ethers } from 'ethers';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

// Transaction details
const TX_HASH = '0xd0f49bdddd01dd1410dd241be252f6f042f2af23fec0889f9bdb2082018cc697';
const NETWORK = NetworkType.AVALANCHE;
const STABLECOIN = StablecoinType.USDC;

// Avalanche Fuji RPC
const RPC_URL = 'https://api.avax-test.network/ext/bc/C/rpc';

// USDC address on Avalanche Fuji
const USDC_ADDRESS = '0x5425890298aed601595a70AB815c96711a31Bc65';

// ERC20 ABI for Transfer event
const ERC20_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'function decimals() view returns (uint8)',
];

async function processDeposit() {
  console.log('🔍 Processing Avalanche USDC deposit...\n');
  console.log(`Transaction: ${TX_HASH}`);
  console.log(`Network: ${NETWORK}`);
  console.log(`Token: ${STABLECOIN}\n`);

  try {
    // Connect to Avalanche Fuji
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);

    // Get transaction receipt
    console.log('📡 Fetching transaction receipt...');
    const receipt = await provider.getTransactionReceipt(TX_HASH);

    if (!receipt) {
      console.error('❌ Transaction not found!');
      console.error('   Make sure the transaction is confirmed on the blockchain.');
      return;
    }

    console.log(`✅ Transaction found!`);
    console.log(`   Block: ${receipt.blockNumber}`);
    console.log(`   Status: ${receipt.status === 1 ? 'Success' : 'Failed'}`);
    console.log(`   Gas used: ${receipt.gasUsed.toString()}\n`);

    if (receipt.status !== 1) {
      console.error('❌ Transaction failed on blockchain!');
      return;
    }

    // Parse Transfer events
    const usdcContract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, provider);
    const transferEvents = receipt.logs
      .map((log) => {
        try {
          return usdcContract.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .filter((event) => event && event.name === 'Transfer');

    console.log(`📝 Found ${transferEvents.length} Transfer events\n`);

    if (transferEvents.length === 0) {
      console.error('❌ No USDC transfer events found in this transaction!');
      return;
    }

    // Process each transfer
    for (const event of transferEvents) {
      if (!event) continue;

      const from = event.args.from;
      const to = event.args.to.toLowerCase();
      const value = event.args.value;
      const amount = parseFloat(ethers.utils.formatUnits(value, 6)); // USDC has 6 decimals

      console.log(`💸 Transfer Event:`);
      console.log(`   From: ${from}`);
      console.log(`   To: ${to}`);
      console.log(`   Amount: ${amount} USDC\n`);

      // Find wallet by deposit address (case-insensitive)
      const wallet = await prisma.wallet.findFirst({
        where: {
          depositAddress: {
            equals: to,
            mode: 'insensitive',
          },
          network: NETWORK,
          stablecoinType: STABLECOIN,
        },
        include: {
          user: {
            select: {
              email: true,
            },
          },
        },
      });

      if (!wallet) {
        console.warn(`⚠️  No wallet found for address: ${to}`);
        console.warn(`   Skipping this transfer...\n`);
        continue;
      }

      console.log(`✅ Wallet found!`);
      console.log(`   User: ${wallet.user.email}`);
      console.log(`   Current balance: $${wallet.balance}\n`);

      // Check if deposit already recorded
      const existingDeposit = await prisma.deposit.findFirst({
        where: {
          txHash: TX_HASH,
          walletId: wallet.id,
        },
      });

      if (existingDeposit) {
        console.log(`✅ Deposit already recorded!`);
        console.log(`   Deposit ID: ${existingDeposit.id}`);
        console.log(`   Status: ${existingDeposit.status}`);
        console.log(`   Amount: $${existingDeposit.amount}\n`);
        continue;
      }

      // Record deposit
      console.log(`💾 Recording deposit...`);

      const deposit = await prisma.deposit.create({
        data: {
          walletId: wallet.id,
          amount: new Decimal(amount),
          txHash: TX_HASH,
          blockNumber: BigInt(receipt.blockNumber),
          fromAddress: from,
          status: TransactionStatus.COMPLETED,
          network: NETWORK,
          confirmations: receipt.confirmations || 1,
          confirmedAt: new Date(),
        },
      });

      console.log(`✅ Deposit recorded!`);
      console.log(`   Deposit ID: ${deposit.id}\n`);

      // Update wallet balance
      console.log(`💰 Updating wallet balance...`);

      const updatedWallet = await prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { increment: new Decimal(amount) },
        },
      });

      console.log(`✅ Wallet updated!`);
      console.log(`   New balance: $${updatedWallet.balance}\n`);

      // Create transaction record
      const transaction = await prisma.transaction.create({
        data: {
          userId: wallet.userId,
          type: 'DEPOSIT',
          status: TransactionStatus.COMPLETED,
          stablecoinType: STABLECOIN,
          network: NETWORK,
          amount: new Decimal(amount),
          fee: 0,
          txHash: TX_HASH,
          blockNumber: receipt.blockNumber.toString(),
          completedAt: new Date(),
        },
      });

      console.log(`✅ Transaction record created!`);
      console.log(`   Transaction ID: ${transaction.id}\n`);

      console.log(`🎉 Deposit processed successfully!`);
      console.log(`   ${amount} USDC added to wallet`);
      console.log(`   New balance: $${updatedWallet.balance}`);
    }

    console.log('\n✨ Done!');
  } catch (error) {
    console.error('\n❌ Error processing deposit:', error);
    throw error;
  }
}

processDeposit()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
