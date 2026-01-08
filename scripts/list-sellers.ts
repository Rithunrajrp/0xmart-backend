import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function listSellers() {
  try {
    const sellers = await prisma.seller.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phoneNumber: true,
            countryCode: true,
            role: true,
          },
        },
      },
    });

    console.log(`\nFound ${sellers.length} seller(s):\n`);

    sellers.forEach((seller, index) => {
      console.log(`${index + 1}. ${seller.companyName}`);
      console.log(`   Seller ID: ${seller.id}`);
      console.log(`   Email: ${seller.email}`);
      console.log(`   Status: ${seller.status}`);
      if (seller.user) {
        console.log(`   User ID: ${seller.user.id}`);
        console.log(`   User Email: ${seller.user.email}`);
        console.log(`   User Phone: ${seller.user.countryCode}${seller.user.phoneNumber}`);
        console.log(`   User Role: ${seller.user.role}`);
      } else {
        console.log(`   User: Not linked`);
      }
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

listSellers();
