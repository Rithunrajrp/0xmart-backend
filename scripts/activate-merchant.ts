import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function activateMerchant() {
  // Get email from command line argument or use default
  const email = process.argv[2] || 'fabellenecosmetics@gmail.com';

  if (!email) {
    console.error('❌ Usage: npx ts-node scripts/activate-merchant.ts <email>');
    process.exit(1);
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { sellerProfile: true },
    });

    if (!user) {
      console.error(`❌ User ${email} not found`);
      process.exit(1);
    }

    console.log(`📋 Current Status:`);
    console.log(`   User Status: ${user.status}`);
    console.log(`   Seller Status: ${user.sellerProfile?.status || 'N/A'}`);

    // Update user to ACTIVE
    const updatedUser = await prisma.user.update({
      where: { email },
      data: { status: 'ACTIVE' },
    });

    // Update seller to ACTIVE if exists
    let updatedSeller: any = null;
    if (user.sellerProfile) {
      updatedSeller = await prisma.seller.update({
        where: { id: user.sellerProfile.id },
        data: {
          status: 'ACTIVE',
          verifiedAt: new Date(), // Mark as verified
          verifiedBy: 'MANUAL_ACTIVATION',
        },
      });
    }

    console.log(`\n✅ Merchant activated successfully!`);
    console.log(`\n📋 New Status:`);
    console.log(`   User Status: ${updatedUser.status}`);
    console.log(`   Seller Status: ${updatedSeller ? updatedSeller.status : 'N/A'}`);
    console.log(`\n✅ ${email} can now login to the merchant portal!`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

activateMerchant();
