import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteAllSellers() {
  try {
    console.log('🗑️  Starting seller profile deletion process...');
    console.log('⚠️  This will delete all sellers and related data in the correct order...\n');

    // Get all sellers
    const sellers = await prisma.seller.findMany({ select: { id: true } });
    const sellerIds = sellers.map(s => s.id);

    console.log(`Found ${sellers.length} sellers to delete`);

    if (sellerIds.length === 0) {
      console.log('No sellers found. Nothing to delete.');
      return;
    }

    // Get all products from these sellers
    const products = await prisma.product.findMany({
      where: { sellerId: { in: sellerIds } },
      select: { id: true }
    });
    const productIds = products.map(p => p.id);

    console.log(`\n📋 Deletion plan:`);
    console.log(`   - ${sellers.length} sellers`);
    console.log(`   - ${products.length} products`);

    // Step 1: Delete ad clicks for these products
    console.log('\n1️⃣ Deleting ad clicks...');
    const adClicksDeleted = await prisma.adClick.deleteMany({
      where: { productId: { in: productIds } },
    });
    console.log(`   ✅ Deleted ${adClicksDeleted.count} ad clicks`);

    // Step 2: Delete favorites for these products
    console.log('2️⃣ Deleting favorites...');
    const favoritesDeleted = await prisma.favorite.deleteMany({
      where: { productId: { in: productIds } },
    });
    console.log(`   ✅ Deleted ${favoritesDeleted.count} favorites`);

    // Step 3: Delete order items for these products
    console.log('3️⃣ Deleting order items...');
    const orderItemsDeleted = await prisma.orderItem.deleteMany({
      where: { productId: { in: productIds } },
    });
    console.log(`   ✅ Deleted ${orderItemsDeleted.count} order items`);

    // Step 4: Delete external orders for these products
    console.log('4️⃣ Deleting external orders...');
    const externalOrdersDeleted = await prisma.externalOrder.deleteMany({
      where: { productId: { in: productIds } },
    });
    console.log(`   ✅ Deleted ${externalOrdersDeleted.count} external orders`);

    // Step 5: Delete products
    console.log('5️⃣ Deleting products...');
    const productsDeleted = await prisma.product.deleteMany({
      where: { id: { in: productIds } },
    });
    console.log(`   ✅ Deleted ${productsDeleted.count} products`);

    // Step 6: Delete sellers
    console.log('6️⃣ Deleting sellers...');
    const sellersDeleted = await prisma.seller.deleteMany({
      where: { id: { in: sellerIds } },
    });
    console.log(`   ✅ Deleted ${sellersDeleted.count} sellers`);

    console.log(`\n✨ Successfully completed deletion!`);
    console.log(`\n📊 Summary:`);
    console.log(`   - Ad Clicks: ${adClicksDeleted.count}`);
    console.log(`   - Favorites: ${favoritesDeleted.count}`);
    console.log(`   - Order Items: ${orderItemsDeleted.count}`);
    console.log(`   - External Orders: ${externalOrdersDeleted.count}`);
    console.log(`   - Products: ${productsDeleted.count}`);
    console.log(`   - Sellers: ${sellersDeleted.count}`);
  } catch (error) {
    console.error('❌ Error deleting sellers:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

deleteAllSellers()
  .then(() => {
    console.log('✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
