/**
 * Update SUI wallet with private key and sweep funds
 *
 * Usage:
 *   ts-node scripts/update-and-sweep-sui.ts
 */

import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { PrismaClient } from '@prisma/client';
import { AddressGeneratorService } from '../src/modules/wallets/services/address-generator.service';
import { SuiBlockchainService } from '../src/modules/wallets/services/sui-blockchain.service';
import { ConfigService } from '@nestjs/config';
import configuration from '../config/configuration';
import * as dotenv from 'dotenv';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { fromBase64 } from '@mysten/sui/utils';

dotenv.config();

const prisma = new PrismaClient();
const configService = new ConfigService(configuration());
const addressGenerator = new AddressGeneratorService();

const TARGET_ADDRESS = '0xdd0a3aca488729fdc9ee918c1b2b700edcfdcb07518dfcf64fb68940f82badb0';

async function updateAndSweep() {
  console.log('\n🔧 SUI Wallet Update & Sweep Script');
  console.log('====================================\n');

  // Get private key from environment
  const privateKeyBech32 = process.env.SUI_ADMIN_PRIVATE_KEY;
  if (!privateKeyBech32) {
    console.error('❌ SUI_ADMIN_PRIVATE_KEY not found in .env file');
    process.exit(1);
  }

  console.log('✅ Private key loaded from .env');
  console.log(`🎯 Target wallet address: ${TARGET_ADDRESS}\n`);

  // Decode the Bech32 private key
  console.log('🔓 Decoding private key...');
  let keypair: Ed25519Keypair;
  try {
    const decoded = decodeSuiPrivateKey(privateKeyBech32);
    keypair = Ed25519Keypair.fromSecretKey(decoded.secretKey);
  } catch (error) {
    console.error('❌ Failed to decode private key:', error.message);
    process.exit(1);
  }

  const address = keypair.getPublicKey().toSuiAddress();
  console.log(`✅ Decoded address: ${address}`);

  // Check if it matches the target address
  if (address.toLowerCase() !== TARGET_ADDRESS.toLowerCase()) {
    console.error(`\n❌ Address mismatch!`);
    console.error(`   Expected: ${TARGET_ADDRESS}`);
    console.error(`   Got: ${address}`);
    console.error('\n⚠️  This private key does not control the target wallet.');
    process.exit(1);
  }

  console.log('✅ Address matches target wallet!\n');

  // Convert to hex format for storage
  const privateKeyHex = Buffer.from(keypair.getSecretKey()).toString('hex');
  console.log(`🔐 Private key (first 10 chars): ${privateKeyHex.substring(0, 10)}...`);

  // Encrypt the private key
  console.log('\n🔒 Encrypting private key...');
  const encryptedPrivateKey = await addressGenerator.encryptPrivateKey(privateKeyHex);
  console.log('✅ Private key encrypted');

  // First, find the wallet
  const existingWallet = await prisma.wallet.findFirst({
    where: {
      depositAddress: TARGET_ADDRESS,
    },
    include: {
      user: {
        select: {
          email: true,
        },
      },
    },
  });

  if (!existingWallet) {
    console.error('❌ Wallet not found in database');
    process.exit(1);
  }

  // Update database
  console.log('\n💾 Updating wallet in database...');
  const wallet = await prisma.wallet.update({
    where: {
      id: existingWallet.id,
    },
    data: {
      encryptedPrivateKey,
    },
  });
  console.log('✅ Database updated');
  console.log(`   User: ${existingWallet.user.email}`);
  console.log(`   Balance: ${existingWallet.balance.toString()} ${existingWallet.stablecoinType}`);

  // Now sweep the funds
  console.log('\n💸 Initiating sweep to hot wallet...');

  const suiHotWallet = configService.get<string>('blockchain.suiHotWallet');
  if (!suiHotWallet) {
    console.error('❌ SUI hot wallet not configured in .env');
    process.exit(1);
  }

  console.log(`   Hot wallet: ${suiHotWallet}`);

  const suiService = new SuiBlockchainService(configService);

  // Token configuration for USDC
  const tokenConfig = {
    address: '0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC',
    decimals: 6,
  };

  console.log(`   Token: ${existingWallet.stablecoinType}`);
  console.log(`   Token address: ${tokenConfig.address}`);

  try {
    const sweepResult = await suiService.sweepCoins(
      privateKeyHex,
      suiHotWallet,
      tokenConfig.address
    );

    if (sweepResult.success) {
      console.log('\n🎉 Sweep successful!');
      console.log(`   Transaction: ${sweepResult.digest}`);
      console.log(`   Amount swept: ${parseFloat(sweepResult.amount) / 1e6} ${existingWallet.stablecoinType}`);
      console.log(`   Gas fee: ${sweepResult.gasFee} MIST`);

      // Create sweep transaction record
      await prisma.sweepTransaction.create({
        data: {
          walletId: existingWallet.id,
          fromAddress: TARGET_ADDRESS,
          toAddress: suiHotWallet,
          amount: parseFloat(sweepResult.amount) / 1e6,
          stablecoinType: existingWallet.stablecoinType,
          network: 'SUI',
          txHash: sweepResult.digest,
          gasUsed: sweepResult.gasFee,
          gasFee: parseFloat(sweepResult.gasFee) / 1e9,
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });
      console.log('✅ Sweep transaction recorded in database');

      console.log('\n🔍 Verify on explorer:');
      console.log(`   https://testnet.suivision.xyz/txblock/${sweepResult.digest}`);
    } else {
      console.error('\n❌ Sweep failed');
    }
  } catch (error) {
    console.error('\n❌ Sweep error:', error.message);
    process.exit(1);
  }

  await prisma.$disconnect();
  console.log('\n✨ Done!\n');
}

updateAndSweep().catch((error) => {
  console.error('\n❌ Fatal error:', error.message);
  console.error(error.stack);
  process.exit(1);
});
