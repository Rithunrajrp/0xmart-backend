import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Activating all products with stock > 0...');

  const result = await prisma.product.updateMany({
    where: {
      stock: {
        gt: 0,
      },
      status: {
        not: 'ACTIVE',
      },
    },
    data: {
      status: 'ACTIVE',
    },
  });

  console.log(`✅ Updated ${result.count} products to ACTIVE status`);

  // Show all products
  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      status: true,
      stock: true,
      category: true,
    },
  });

  console.log('\nAll products:');
  console.table(products);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
