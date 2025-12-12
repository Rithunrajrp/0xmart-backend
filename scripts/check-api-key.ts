import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const apiKeyToCheck = 'xmart_v5EWtv_CnwqGep33ReFfSdO408IPlOXu';
  const prefix = apiKeyToCheck.substring(0, 8);

  console.log(`Checking API key with prefix: ${prefix}`);

  const key = await prisma.apiKey.findFirst({
    where: { prefix },
    include: { user: true },
  });

  if (!key) {
    console.log('❌ API Key NOT FOUND in database');
    console.log('\nAll API keys:');
    const allKeys = await prisma.apiKey.findMany({
      select: { id: true, name: true, prefix: true, status: true },
    });
    console.table(allKeys);
    return;
  }

  console.log('\n✅ API Key found:');
  console.log({
    id: key.id,
    name: key.name,
    prefix: key.prefix,
    status: key.status,
    expiresAt: key.expiresAt,
    userId: key.userId,
    userEmail: key.user.email,
    userStatus: key.user.status,
  });

  // Test bcrypt comparison
  const bcrypt = require('bcrypt');
  const isValid = await bcrypt.compare(apiKeyToCheck, key.keyHash);
  console.log(`\nBcrypt validation: ${isValid ? '✅ VALID' : '❌ INVALID'}`);

  if (!isValid) {
    console.log('\n⚠️ The API key does not match the stored hash!');
    console.log('This means the key in config.js is not the correct key.');
    console.log('You need to create a new API key and copy it immediately when shown.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
