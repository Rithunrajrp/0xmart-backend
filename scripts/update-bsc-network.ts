import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Updating BSC network configuration...');

  const updated = await prisma.networkConfig.update({
    where: { network: 'BSC' },
    data: {
      contractDeployed: true,
      contractAddress: '0xfFfD214731036E826A283d1600c967771fDdABAe',
      lastContractCheck: new Date(),
    },
  });

  console.log('BSC network updated successfully:', updated);
}

main()
  .catch((e) => {
    console.error('Error updating BSC network:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
