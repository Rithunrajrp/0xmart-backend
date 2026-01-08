import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateFabelleneToMerchant() {
  const email = 'fabellenecosmetics@gmail.com';

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { sellerProfile: true },
    });

    if (!user) {
      console.error(`❌ User ${email} not found`);
      process.exit(1);
    }

    console.log(`Found user: ${user.email}`);
    console.log(`Current role: ${user.role}`);
    console.log(`Has seller profile: ${user.sellerProfile ? 'Yes' : 'No'}`);

    if (!user.sellerProfile) {
      console.error(`❌ User ${email} does not have a seller profile`);
      process.exit(1);
    }

    if (user.role === 'MERCHANT') {
      console.log(`✅ User ${email} already has MERCHANT role`);
      process.exit(0);
    }

    // Update to MERCHANT role
    const updatedUser = await prisma.user.update({
      where: { email },
      data: { role: 'MERCHANT' },
    });

    console.log(`\n✅ Successfully updated ${email} to MERCHANT role`);
    console.log(`   Previous role: ${user.role}`);
    console.log(`   New role: ${updatedUser.role}`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

updateFabelleneToMerchant();
