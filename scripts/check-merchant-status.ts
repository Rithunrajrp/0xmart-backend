import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkMerchantStatus() {
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

    console.log('\n📋 User Account Details:');
    console.log(`   Email: ${user.email}`);
    console.log(`   User ID: ${user.id}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Status: ${user.status}`);
    console.log(`   KYC Status: ${user.kycStatus}`);
    console.log(`   Phone: ${user.countryCode}${user.phoneNumber}`);
    console.log(`   Created: ${user.createdAt}`);
    console.log(`   Last Login: ${user.lastLoginAt || 'Never'}`);

    if (user.sellerProfile) {
      console.log('\n📋 Seller Profile Details:');
      console.log(`   Seller ID: ${user.sellerProfile.id}`);
      console.log(`   Company: ${user.sellerProfile.companyName}`);
      console.log(`   Trading Name: ${user.sellerProfile.tradingName || 'N/A'}`);
      console.log(`   Seller Status: ${user.sellerProfile.status}`);
      console.log(`   Seller Type: ${user.sellerProfile.sellerType}`);
      console.log(`   Verified: ${user.sellerProfile.verifiedAt ? 'Yes' : 'No'}`);
      console.log(`   Created: ${user.sellerProfile.createdAt}`);
    } else {
      console.log('\n❌ No seller profile found');
    }

    // Check if user can login
    console.log('\n🔐 Login Status:');
    if (user.status === 'SUSPENDED') {
      console.log(`   ❌ CANNOT LOGIN - Account is SUSPENDED`);
      console.log(`   ℹ️  User status needs to be ACTIVE for login`);
    } else if (user.status === 'ACTIVE') {
      console.log(`   ✅ CAN LOGIN - Account is ACTIVE`);
    } else {
      console.log(`   ⚠️  Status: ${user.status}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkMerchantStatus();
