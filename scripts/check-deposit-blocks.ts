import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkBlocks() {
  const deposits = await prisma.deposit.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  console.log('\nRecent deposits (newest first):');
  deposits.forEach((d) => {
    console.log(`Block: ${d.blockNumber ? d.blockNumber.toString() : 'null'}, Amount: $${d.amount}, Created: ${d.createdAt.toISOString()}`);
    console.log(`  TX: ${d.txHash}\n`);
  });
}

checkBlocks()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
