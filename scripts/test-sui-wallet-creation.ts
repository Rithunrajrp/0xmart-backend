/**
 * Test script to verify master seed is loaded and wallet creation works with encrypted keys
 */

import { PrismaClient } from '@prisma/client';
import { AddressGeneratorService } from '../src/modules/wallets/services/address-generator.service';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const addressGenerator = new AddressGeneratorService();

async function testWalletCreation() {
  console.log('\n🧪 Testing SUI Wallet Creation with Master Seed');
  console.log('=================================================\n');

  // Check if master seed is loaded
  const masterSeed = process.env.MASTER_SEED;
  if (!masterSeed) {
    console.error('❌ MASTER_SEED not found in .env');
    process.exit(1);
  }

  console.log('✅ Master seed loaded from .env');
  console.log(`   Words: ${masterSeed.split(' ').length}`);

  // Generate a test SUI address
  console.log('\n🔑 Generating test SUI address...');
  const testIndex = Math.floor(Math.random() * 1000) + 1000; // Random index to avoid conflicts

  try {
    const generated = await addressGenerator.generateDepositAddress(
      'test-user-id',
      testIndex,
      'SUI'
    );

    console.log('✅ Address generated successfully!');
    console.log(`   Address: ${generated.address}`);
    console.log(`   Private Key (first 10 chars): ${generated.privateKey.substring(0, 10)}...`);

    // Test encryption
    console.log('\n🔐 Testing private key encryption...');
    const encrypted = await addressGenerator.encryptPrivateKey(generated.privateKey);
    console.log('✅ Private key encrypted');
    console.log(`   Encrypted (first 20 chars): ${encrypted.substring(0, 20)}...`);

    // Test decryption
    console.log('\n🔓 Testing private key decryption...');
    const decrypted = await addressGenerator.decryptPrivateKey(encrypted);

    if (decrypted === generated.privateKey) {
      console.log('✅ Decryption successful - keys match!');
    } else {
      console.error('❌ Decryption failed - keys do not match');
      process.exit(1);
    }

    console.log('\n🎉 All tests passed!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Master seed loaded correctly');
    console.log('   ✅ SUI address generation working');
    console.log('   ✅ Private key encryption working');
    console.log('   ✅ Private key decryption working');

    console.log('\n✨ Your backend is ready for automatic sweep!');
    console.log('\n📌 Next steps:');
    console.log('   1. Create a new SUI wallet via API');
    console.log('   2. Send test USDC to the deposit address');
    console.log('   3. Wait for automatic sweep to hot wallet');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }

  await prisma.$disconnect();
}

testWalletCreation();
