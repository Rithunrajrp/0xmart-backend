import { PrismaClient, OrderStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function fixStuckOrders() {
  console.log('🔍 Finding stuck PAYMENT_PENDING orders...\n');

  // Find all orders stuck in PAYMENT_PENDING status with deposit payment method
  const stuckOrders = await prisma.order.findMany({
    where: {
      status: OrderStatus.PAYMENT_PENDING,
      metadata: {
        path: ['paymentMethod'],
        equals: 'deposit',
      },
    },
    include: {
      transactions: true,
      user: {
        select: {
          email: true,
        },
      },
    },
  });

  console.log(`Found ${stuckOrders.length} stuck orders\n`);

  if (stuckOrders.length === 0) {
    console.log('✅ No stuck orders found!');
    return;
  }

  // Process each stuck order
  for (const order of stuckOrders) {
    console.log(`\n📦 Order: ${order.orderNumber}`);
    console.log(`   User: ${order.user.email}`);
    console.log(`   Amount: $${order.total} ${order.stablecoinType}`);
    console.log(`   Created: ${order.createdAt}`);

    const metadata = order.metadata as any;
    const network = metadata?.network || 'POLYGON';

    console.log(`   Network: ${network}`);

    // Find the wallet
    const wallet = await prisma.wallet.findUnique({
      where: {
        userId_stablecoinType_network: {
          userId: order.userId,
          stablecoinType: order.stablecoinType,
          network: network,
        },
      },
    });

    if (!wallet) {
      console.log(`   ❌ Wallet not found on ${network}`);
      console.log(`   📝 Cancelling order and unlocking balance...`);

      // Cancel the order and try to unlock balance on any network
      const allWallets = await prisma.wallet.findMany({
        where: {
          userId: order.userId,
          stablecoinType: order.stablecoinType,
        },
      });

      for (const w of allWallets) {
        if (parseFloat(w.lockedBalance.toString()) > 0) {
          await prisma.wallet.update({
            where: { id: w.id },
            data: {
              lockedBalance: { decrement: order.total },
            },
          });
          console.log(`   ✅ Unlocked $${order.total} on ${w.network}`);
        }
      }

      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.CANCELLED,
          cancelledAt: new Date(),
        },
      });

      console.log(`   ✅ Order cancelled`);
      continue;
    }

    console.log(`   💰 Wallet balance: $${wallet.balance}`);
    console.log(`   🔒 Locked balance: $${wallet.lockedBalance}`);

    // Check if there's enough locked balance to process
    if (parseFloat(wallet.lockedBalance.toString()) < parseFloat(order.total.toString())) {
      console.log(`   ❌ Insufficient locked balance, cancelling order...`);

      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.CANCELLED,
          cancelledAt: new Date(),
        },
      });

      // Unlock whatever is locked
      if (parseFloat(wallet.lockedBalance.toString()) > 0) {
        await prisma.wallet.update({
          where: { id: wallet.id },
          data: {
            lockedBalance: 0,
          },
        });
        console.log(`   ✅ Unlocked all locked balance`);
      }

      console.log(`   ✅ Order cancelled`);
      continue;
    }

    // Process the order payment
    console.log(`   💳 Processing payment...`);

    try {
      await prisma.$transaction(async (tx) => {
        // Update wallet: deduct from balance and locked balance
        await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            balance: { decrement: order.total },
            lockedBalance: { decrement: order.total },
          },
        });

        // Update order status to CONFIRMED
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: OrderStatus.CONFIRMED,
            paidAt: new Date(),
          },
        });

        // Update transaction status
        await tx.transaction.updateMany({
          where: { orderId: order.id },
          data: {
            status: 'COMPLETED',
          },
        });
      });

      console.log(`   ✅ Payment processed successfully!`);
      console.log(`   ✅ Order status: CONFIRMED`);
    } catch (error) {
      console.error(`   ❌ Error processing payment:`, error);
    }
  }

  console.log('\n\n✨ Done!');
}

fixStuckOrders()
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
