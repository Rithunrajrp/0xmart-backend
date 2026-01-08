import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixPhoneNumberFormat() {
  const email = 'fabellenecosmetics@gmail.com';

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.error(`❌ User ${email} not found`);
      process.exit(1);
    }

    console.log(`📋 Current Phone Number: ${user.phoneNumber}`);
    console.log(`📋 Current Country Code: ${user.countryCode}`);

    // Extract country code and phone number
    let countryCode = user.countryCode;
    let phoneNumber = user.phoneNumber;

    // If phone number starts with +, split it
    if (phoneNumber.startsWith('+')) {
      // Extract country code from phone number
      const match = phoneNumber.match(/^\+(\d{1,4})(\d+)$/);
      if (match) {
        countryCode = `+${match[1]}`;
        phoneNumber = match[2];
      }
    }

    // Remove any non-digit characters from phone number
    phoneNumber = phoneNumber.replace(/\D/g, '');

    // Ensure country code has + prefix
    if (!countryCode.startsWith('+')) {
      countryCode = `+${countryCode}`;
    }

    console.log(`\n📝 New Country Code: ${countryCode}`);
    console.log(`📝 New Phone Number: ${phoneNumber}`);

    // Update user
    const updatedUser = await prisma.user.update({
      where: { email },
      data: {
        countryCode,
        phoneNumber,
      },
    });

    console.log(`\n✅ Phone number fixed successfully!`);
    console.log(`   Country Code: ${updatedUser.countryCode}`);
    console.log(`   Phone Number: ${updatedUser.phoneNumber}`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fixPhoneNumberFormat();
