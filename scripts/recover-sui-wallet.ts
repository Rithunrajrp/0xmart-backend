/**
 * Recovery script to derive SUI private key from master seed and update wallet
 *
 * Usage:
 *   ts-node scripts/recover-sui-wallet.ts
 */

import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { PrismaClient } from '@prisma/client';
import * as bip39 from 'bip39';
import { derivePath } from 'ed25519-hd-key';
import { AddressGeneratorService } from '../src/modules/wallets/services/address-generator.service';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const addressGenerator = new AddressGeneratorService();

const TARGET_ADDRESS = '0xdd0a3aca488729fdc9ee918c1b2b700edcfdcb07518dfcf64fb68940f82badb0';

async function recoverWallet() {
  console.log('\n🔍 SUI Wallet Recovery Script');
  console.log('==============================\n');

  // Get master seed from environment
  const masterSeed = process.env.MASTER_SEED;
  if (!masterSeed) {
    console.error('❌ MASTER_SEED not found in .env file');
    console.log('\n⚠️  Please add your master seed mnemonic to .env:');
    console.log('MASTER_SEED="your twelve or twenty-four word mnemonic here"');
    process.exit(1);
  }

  // Validate mnemonic
  if (!bip39.validateMnemonic(masterSeed)) {
    console.error('❌ Invalid mnemonic in MASTER_SEED');
    process.exit(1);
  }

  console.log('✅ Master seed loaded and validated');
  console.log(`🎯 Target address: ${TARGET_ADDRESS}\n`);

  // Convert mnemonic to seed
  const seed = await bip39.mnemonicToSeed(masterSeed);

  // Try different derivation indices (0-100)
  console.log('🔎 Searching for matching derivation index...\n');

  for (let i = 0; i < 100; i++) {
    // SUI uses BIP44 path: m/44'/784'/0'/0'/i'
    const path = `m/44'/784'/0'/0'/${i}'`;
    const derivedSeed = derivePath(path, seed.toString('hex')).key;
    const keypair = Ed25519Keypair.fromSecretKey(derivedSeed);
    const address = keypair.getPublicKey().toSuiAddress();

    if (address.toLowerCase() === TARGET_ADDRESS.toLowerCase()) {
      console.log(`✅ MATCH FOUND!`);
      console.log(`   Derivation Index: ${i}`);
      console.log(`   Derivation Path: ${path}`);
      console.log(`   Address: ${address}`);

      // Get private key
      const privateKeyHex = Buffer.from(keypair.getSecretKey()).toString('hex');
      console.log(`   Private Key (first 10 chars): ${privateKeyHex.substring(0, 10)}...`);

      // Encrypt the private key
      console.log('\n🔐 Encrypting private key...');
      const encryptedPrivateKey = await addressGenerator.encryptPrivateKey(privateKeyHex);
      console.log('✅ Private key encrypted');

      // Update database
      console.log('\n💾 Updating database...');
      await prisma.wallet.update({
        where: {
          depositAddress: TARGET_ADDRESS,
        },
        data: {
          encryptedPrivateKey,
        },
      });
      console.log('✅ Database updated with encrypted private key');

      console.log('\n🎉 Recovery complete!');
      console.log('\nNext steps:');
      console.log('1. Run: npm run sweep-existing -- --network=SUI --dry-run');
      console.log('2. If dry-run looks good, run: npm run sweep-existing -- --network=SUI');

      await prisma.$disconnect();
      return;
    }

    if (i % 10 === 0) {
      process.stdout.write(`   Checked indices 0-${i}...\r`);
    }
  }

  console.log('\n\n❌ No matching address found in first 100 indices');
  console.log('The wallet might have been created with a different master seed');
  console.log('or a different derivation path.\n');

  await prisma.$disconnect();
}

recoverWallet().catch((error) => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
