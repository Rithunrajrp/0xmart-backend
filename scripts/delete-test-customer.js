const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function deleteTestCustomer() {
  try {
    const email = 'rithunravi@gmail.com';

    // Find the customer
    const customer = await prisma.externalCustomer.findUnique({
      where: { email },
      include: {
        orders: true,
      },
    });

    if (!customer) {
      console.log(`No customer found with email: ${email}`);
      return;
    }

    console.log('Found customer:', {
      id: customer.id,
      email: customer.email,
      phone: customer.phone,
      countryCode: customer.countryCode,
      ordersCount: customer.orders.length,
    });

    // Delete in a transaction to handle foreign keys
    await prisma.$transaction(async (tx) => {
      // First delete all related orders
      if (customer.orders.length > 0) {
        await tx.externalOrder.deleteMany({
          where: { customerId: customer.id },
        });
        console.log(`Deleted ${customer.orders.length} related orders`);
      }

      // Then delete the customer
      await tx.externalCustomer.delete({
        where: { email },
      });
    });

    console.log(`✅ Successfully deleted customer with email: ${email}`);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

deleteTestCustomer();
