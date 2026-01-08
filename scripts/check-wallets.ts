import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkWallets() {
  console.log('🔍 Checking wallets for user...\n');

  // Find user by email
  const user = await prisma.user.findFirst({
    where: {
      email: 'rithunravi@gmail.com',
    },
  });

  if (!user) {
    console.log('❌ User not found!');
    return;
  }

  console.log(`✅ User found: ${user.email}\n`);

  // Get all wallets
  const wallets = await prisma.wallet.findMany({
    where: {
      userId: user.id,
    },
    orderBy: [
      { network: 'asc' },
      { stablecoinType: 'asc' },
    ],
  });

  console.log(`📋 Found ${wallets.length} wallets:\n`);

  wallets.forEach((wallet) => {
    console.log(`${wallet.stablecoinType} - ${wallet.network}`);
    console.log(`  Address: ${wallet.depositAddress}`);
    console.log(`  Balance: $${wallet.balance}`);
    console.log(`  Locked: $${wallet.lockedBalance}\n`);
  });

  // Check if the deposit address exists
  const depositAddress = '0x8ba95ddb3ae822894541215f2a65cc23328da10c';
  const matchingWallet = wallets.find(
    (w) => w.depositAddress.toLowerCase() === depositAddress.toLowerCase()
  );

  if (matchingWallet) {
    console.log(`\n✅ Deposit address ${depositAddress} found!`);
    console.log(`   Wallet: ${matchingWallet.stablecoinType} - ${matchingWallet.network}`);
  } else {
    console.log(`\n❌ Deposit address ${depositAddress} NOT found in any wallet!`);
    console.log(`\nYou need to create an AVALANCHE USDC wallet first.`);
  }
}

checkWallets()
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
