import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function setMerchantPendingOnboarding() {
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

    console.log(`📋 Current Status:`);
    console.log(`   User Status: ${user.status}`);
    console.log(`   User Role: ${user.role}`);
    console.log(`   Seller Status: ${user.sellerProfile?.status || 'N/A'}`);

    // Update user to ACTIVE with MERCHANT role, seller to PENDING_ONBOARDING
    const updatedUser = await prisma.user.update({
      where: { email },
      data: {
        status: 'ACTIVE',
        role: 'MERCHANT',
      },
    });

    let updatedSeller: any = null;
    if (user.sellerProfile) {
      updatedSeller = await prisma.seller.update({
        where: { id: user.sellerProfile.id },
        data: {
          status: 'PENDING_ONBOARDING',
          verifiedAt: null, // Clear verification until onboarding completes
          verifiedBy: null,
        },
      });
    }

    console.log(`\n✅ Merchant account updated successfully!`);
    console.log(`\n📋 New Status:`);
    console.log(`   User Status: ${updatedUser.status} (can login)`);
    console.log(`   User Role: ${updatedUser.role}`);
    console.log(`   Seller Status: ${updatedSeller ? updatedSeller.status : 'N/A'} (must complete onboarding)`);
    console.log(`\n✅ ${email} can login but must complete onboarding to activate seller profile!`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

setMerchantPendingOnboarding();
