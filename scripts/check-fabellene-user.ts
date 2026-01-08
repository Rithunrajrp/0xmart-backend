import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUser() {
  try {
    // Check by email
    const userByEmail = await prisma.user.findUnique({
      where: { email: 'fabellenecosmetics@gmail.com' },
      include: { sellerProfile: true },
    });

    console.log('\n=== User by email (fabellenecosmetics@gmail.com) ===');
    if (userByEmail) {
      console.log(`Found: ${userByEmail.email}`);
      console.log(`ID: ${userByEmail.id}`);
      console.log(`Role: ${userByEmail.role}`);
      console.log(`Phone: ${userByEmail.countryCode}${userByEmail.phoneNumber}`);
      console.log(`Has seller profile: ${userByEmail.sellerProfile ? 'Yes' : 'No'}`);
    } else {
      console.log('Not found');
    }

    // Check all users
    console.log('\n=== All users ===');
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        phoneNumber: true,
        role: true,
      },
    });
    console.table(allUsers);

    // Check the seller
    console.log('\n=== Seller with email fabellenecosmetics@gmail.com ===');
    const seller = await prisma.seller.findUnique({
      where: { email: 'fabellenecosmetics@gmail.com' },
    });
    if (seller) {
      console.log(`Seller ID: ${seller.id}`);
      console.log(`Company: ${seller.companyName}`);
      console.log(`User ID: ${seller.userId}`);
      console.log(`Email: ${seller.email}`);

      // Try to find user by this userId
      if (seller.userId) {
        const userById = await prisma.user.findUnique({
          where: { id: seller.userId },
        });
        console.log(`\nUser linked to seller:`);
        if (userById) {
          console.log(`  Found: ${userById.email || userById.phoneNumber}`);
          console.log(`  ID: ${userById.id}`);
          console.log(`  Role: ${userById.role}`);
        } else {
          console.log(`  NOT FOUND - userId ${seller.userId} does not exist!`);
        }
      }
    } else {
      console.log('Seller not found');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUser();
