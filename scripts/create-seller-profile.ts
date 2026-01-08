import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createSellerProfile() {
  const email = 'fabellenecosmetics@gmail.com';

  try {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      include: { sellerProfile: true },
    });

    if (!user) {
      console.error(`❌ User with email ${email} not found`);
      process.exit(1);
    }

    console.log(`✅ Found user: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);

    // Check if seller profile already exists
    if (user.sellerProfile) {
      console.log(`ℹ️  Seller profile already exists for this user`);
      console.log(`   Seller ID: ${user.sellerProfile.id}`);
      console.log(`   Company: ${user.sellerProfile.companyName}`);
      console.log(`   Status: ${user.sellerProfile.status}`);
      process.exit(0);
    }

    // Create seller profile and update user role to MERCHANT
    const [seller, updatedUser] = await prisma.$transaction([
      prisma.seller.create({
        data: {
          userId: user.id,
          companyName: 'Fabellene Cosmetics',
          tradingName: 'Fabellene',
          sellerType: 'BRAND', // Options: MANUFACTURER, DISTRIBUTOR, WHOLESALER, RETAILER, AGENCY, BRAND, INDIVIDUAL
          status: 'ACTIVE', // Skip verification for now (PENDING_VERIFICATION, APPROVED, ACTIVE, SUSPENDED, REJECTED)
          email: user.email!,
          phone: `${user.countryCode}${user.phoneNumber}`,
          country: 'USA', // Change as needed
          description: 'Premium cosmetics and beauty products',
          verifiedAt: new Date(), // Mark as verified
          verifiedBy: 'MANUAL_CREATION', // Indicate manual creation
        },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { role: 'MERCHANT' },
      }),
    ]);

    console.log(`\n🎉 Seller profile created successfully!`);
    console.log(`   Seller ID: ${seller.id}`);
    console.log(`   Company Name: ${seller.companyName}`);
    console.log(`   Trading Name: ${seller.tradingName}`);
    console.log(`   Type: ${seller.sellerType}`);
    console.log(`   Status: ${seller.status}`);
    console.log(`   Email: ${seller.email}`);
    console.log(`   User Role: ${updatedUser.role}`);
    console.log(`\n✅ User ${email} can now access the merchant portal!`);

  } catch (error) {
    console.error('❌ Error creating seller profile:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createSellerProfile();
