import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixFabelleneAccount() {
  const email = 'fabellenecosmetics@gmail.com';

  try {
    // Find the seller profile
    const seller = await prisma.seller.findUnique({
      where: { email },
    });

    if (!seller) {
      console.error(`❌ Seller with email ${email} not found`);
      process.exit(1);
    }

    console.log(`✅ Found seller: ${seller.companyName}`);
    console.log(`   Seller ID: ${seller.id}`);
    console.log(`   User ID: ${seller.userId || 'NULL (not linked)'}`);
    console.log(`   Phone: ${seller.phone}`);

    // Check if user exists with this email
    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.log(`\n📝 Creating user account for ${email}...`);

      // Extract phone number (assuming format: +918754011177 or similar)
      const phoneMatch = seller.phone?.match(/^(\+\d+)?(\d+)$/);
      const countryCode = '+91'; // Default to India, adjust as needed
      const phoneNumber = seller.phone || '0000000000';

      // Generate unique referral code
      const referralCode = Math.random().toString(36).substring(2, 10).toUpperCase();

      user = await prisma.user.create({
        data: {
          email,
          phoneNumber: phoneNumber.replace(/^\+\d+/, ''), // Remove country code if present
          countryCode,
          role: 'MERCHANT',
          status: 'ACTIVE',
          kycStatus: 'NOT_STARTED',
          referralCode,
        },
      });

      console.log(`✅ User created successfully`);
      console.log(`   User ID: ${user.id}`);
      console.log(`   Role: ${user.role}`);
    } else {
      console.log(`\n✅ User already exists: ${user.email}`);
      console.log(`   User ID: ${user.id}`);
      console.log(`   Current Role: ${user.role}`);

      // Update role to MERCHANT if not already
      if (user.role !== 'MERCHANT') {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { role: 'MERCHANT' },
        });
        console.log(`   ✅ Updated role to MERCHANT`);
      }
    }

    // Link seller to user
    if (seller.userId !== user.id) {
      console.log(`\n🔗 Linking seller profile to user...`);
      await prisma.seller.update({
        where: { id: seller.id },
        data: { userId: user.id },
      });
      console.log(`✅ Seller profile linked to user successfully`);
    } else {
      console.log(`\n✅ Seller profile already linked to user`);
    }

    console.log(`\n🎉 Account fixed successfully!`);
    console.log(`\n📋 Final Account Details:`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Company: ${seller.companyName}`);
    console.log(`   Seller Status: ${seller.status}`);
    console.log(`\n✅ ${email} can now login to the merchant portal!`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fixFabelleneAccount();
