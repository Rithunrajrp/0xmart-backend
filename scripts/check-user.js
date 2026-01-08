const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkUser() {
  try {
    const email = 'rithunravi@gmail.com';
    const phone = '+918754011177';

    // Check User table by email
    const userByEmail = await prisma.user.findUnique({
      where: { email },
    });

    if (userByEmail) {
      console.log('✅ Found in User table (by email):');
      console.log({
        id: userByEmail.id,
        email: userByEmail.email,
        phoneNumber: userByEmail.phoneNumber || 'NULL',
        role: userByEmail.role,
      });
    } else {
      console.log('❌ Not found in User table by email');
    }

    // Check User table by phone
    const userByPhone = await prisma.user.findUnique({
      where: { phoneNumber: phone },
    });

    if (userByPhone) {
      console.log('\n✅ Found in User table (by phone):');
      console.log({
        id: userByPhone.id,
        email: userByPhone.email || 'NULL',
        phoneNumber: userByPhone.phoneNumber,
        role: userByPhone.role,
      });
    } else {
      console.log('\n❌ Not found in User table by phone');
    }

    // Check ExternalCustomer table
    const externalCustomer = await prisma.externalCustomer.findUnique({
      where: { email },
    });

    if (externalCustomer) {
      console.log('\n✅ Found in ExternalCustomer table:');
      console.log({
        id: externalCustomer.id,
        email: externalCustomer.email,
        phone: externalCustomer.phone,
      });
    } else {
      console.log('\n❌ Not found in ExternalCustomer table (this is OK)');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkUser();
