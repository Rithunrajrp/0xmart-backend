/**
 * Sweep Existing Balances Script
 *
 * This script sweeps existing balances from SUI and Solana deposit addresses
 * that were deposited BEFORE the automatic sweep mechanism was implemented.
 *
 * Usage:
 *   npm run sweep-existing -- --network=SUI
 *   npm run sweep-existing -- --network=SOLANA
 *   npm run sweep-existing -- --network=ALL
 *   npm run sweep-existing -- --network=SUI --dry-run
 */

import { PrismaClient, NetworkType } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { AddressGeneratorService } from '../src/modules/wallets/services/address-generator.service';
import { SuiBlockchainService } from '../src/modules/wallets/services/sui-blockchain.service';
import { SolanaBlockchainService } from '../src/modules/wallets/services/solana-blockchain.service';
import { Decimal } from '@prisma/client/runtime/library';
import * as dotenv from 'dotenv';
import configuration from '../config/configuration';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();
const configService = new ConfigService(configuration());
const addressGenerator = new AddressGeneratorService();

// Token configurations (same as in deposit-monitor.service.ts)
const TOKEN_ADDRESSES = {
  SUI: {
    USDT: {
      address: '0xf7152c05330a500cc732c2fedac336ab2dfc6df1edadfa966c7b57fe53c2c916::usdt::USDT',
      decimals: 6,
    },
    USDC: {
      address: '0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC',
      decimals: 6,
    },
  },
  SOLANA: {
    USDT: {
      address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
      decimals: 6,
    },
    USDC: {
      address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      decimals: 6,
    },
  },
};

interface SweepResult {
  walletId: string;
  network: string;
  stablecoinType: string;
  depositAddress: string;
  amount: string;
  txHash?: string;
  success: boolean;
  error?: string;
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    network: 'ALL' as 'SUI' | 'SOLANA' | 'ALL',
    dryRun: false,
  };

  args.forEach((arg) => {
    if (arg.startsWith('--network=')) {
      const network = arg.split('=')[1].toUpperCase();
      if (['SUI', 'SOLANA', 'ALL'].includes(network)) {
        options.network = network as any;
      }
    }
    if (arg === '--dry-run') {
      options.dryRun = true;
    }
  });

  return options;
}

/**
 * Get wallets with potential balances on-chain
 */
async function getWalletsToSweep(network: NetworkType) {
  console.log(`\n📋 Fetching ${network} wallets...`);

  const wallets = await prisma.wallet.findMany({
    where: {
      network,
      encryptedPrivateKey: {
        not: null, // Only wallets with stored private keys
      },
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  });

  console.log(`Found ${wallets.length} ${network} wallets with private keys stored`);
  return wallets;
}

/**
 * Check on-chain balance for SUI wallet
 */
async function checkSuiBalance(
  suiService: SuiBlockchainService,
  depositAddress: string,
  tokenConfig: any,
): Promise<string> {
  try {
    const balance = await suiService.getCoinBalance(
      depositAddress,
      tokenConfig.address,
    );
    return balance.totalBalance;
  } catch (error) {
    console.error(`Error checking SUI balance: ${error.message}`);
    return '0';
  }
}

/**
 * Check on-chain balance for Solana wallet
 */
async function checkSolanaBalance(
  solanaService: SolanaBlockchainService,
  depositAddress: string,
  tokenConfig: any,
): Promise<string> {
  try {
    const tokenAccount = await solanaService.getTokenAccount(
      depositAddress,
      tokenConfig.address,
    );
    return tokenAccount?.balance || '0';
  } catch (error) {
    console.error(`Error checking Solana balance: ${error.message}`);
    return '0';
  }
}

/**
 * Sweep SUI wallet
 */
async function sweepSuiWallet(
  suiService: SuiBlockchainService,
  wallet: any,
  hotWalletAddress: string,
  dryRun: boolean,
): Promise<SweepResult> {
  const result: SweepResult = {
    walletId: wallet.id,
    network: 'SUI',
    stablecoinType: wallet.stablecoinType,
    depositAddress: wallet.depositAddress,
    amount: '0',
    success: false,
  };

  try {
    // Get token config
    const tokenConfig = TOKEN_ADDRESSES.SUI[wallet.stablecoinType];
    if (!tokenConfig) {
      result.error = 'Token not configured';
      return result;
    }

    // Check on-chain balance
    const onChainBalance = await checkSuiBalance(
      suiService,
      wallet.depositAddress,
      tokenConfig,
    );

    result.amount = new Decimal(onChainBalance)
      .div(Math.pow(10, tokenConfig.decimals))
      .toString();

    if (onChainBalance === '0') {
      result.error = 'Zero balance';
      return result;
    }

    console.log(`  💰 Balance: ${result.amount} ${wallet.stablecoinType}`);

    if (dryRun) {
      result.success = true;
      result.error = 'DRY RUN - not executed';
      return result;
    }

    // Decrypt private key
    const privateKey = await addressGenerator.decryptPrivateKey(
      wallet.encryptedPrivateKey,
    );

    // Execute sweep
    const sweepResult = await suiService.sweepCoins(
      privateKey,
      hotWalletAddress,
      tokenConfig.address,
    );

    if (sweepResult.success) {
      result.success = true;
      result.txHash = sweepResult.digest;

      // Create sweep transaction record
      await prisma.sweepTransaction.create({
        data: {
          walletId: wallet.id,
          fromAddress: wallet.depositAddress,
          toAddress: hotWalletAddress,
          amount: new Decimal(result.amount),
          stablecoinType: wallet.stablecoinType,
          network: 'SUI',
          txHash: sweepResult.digest,
          gasUsed: sweepResult.gasFee,
          gasFee: new Decimal(sweepResult.gasFee).div(1e9),
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      console.log(`  ✅ Swept! TX: ${sweepResult.digest}`);
    } else {
      result.error = 'Sweep failed';
    }
  } catch (error) {
    result.error = error.message;
    console.error(`  ❌ Error: ${error.message}`);
  }

  return result;
}

/**
 * Sweep Solana wallet
 */
async function sweepSolanaWallet(
  solanaService: SolanaBlockchainService,
  wallet: any,
  hotWalletAddress: string,
  dryRun: boolean,
): Promise<SweepResult> {
  const result: SweepResult = {
    walletId: wallet.id,
    network: 'SOLANA',
    stablecoinType: wallet.stablecoinType,
    depositAddress: wallet.depositAddress,
    amount: '0',
    success: false,
  };

  try {
    // Get token config
    const tokenConfig = TOKEN_ADDRESSES.SOLANA[wallet.stablecoinType];
    if (!tokenConfig) {
      result.error = 'Token not configured';
      return result;
    }

    // Check on-chain balance
    const onChainBalance = await checkSolanaBalance(
      solanaService,
      wallet.depositAddress,
      tokenConfig,
    );

    result.amount = new Decimal(onChainBalance)
      .div(Math.pow(10, tokenConfig.decimals))
      .toString();

    if (onChainBalance === '0') {
      result.error = 'Zero balance';
      return result;
    }

    console.log(`  💰 Balance: ${result.amount} ${wallet.stablecoinType}`);

    if (dryRun) {
      result.success = true;
      result.error = 'DRY RUN - not executed';
      return result;
    }

    // Decrypt private key
    const privateKey = await addressGenerator.decryptPrivateKey(
      wallet.encryptedPrivateKey,
    );

    // Execute sweep
    const sweepResult = await solanaService.sweepTokens(
      privateKey,
      hotWalletAddress,
      tokenConfig.address,
    );

    if (sweepResult.success) {
      result.success = true;
      result.txHash = sweepResult.signature;

      // Create sweep transaction record
      await prisma.sweepTransaction.create({
        data: {
          walletId: wallet.id,
          fromAddress: wallet.depositAddress,
          toAddress: hotWalletAddress,
          amount: new Decimal(result.amount),
          stablecoinType: wallet.stablecoinType,
          network: 'SOLANA',
          txHash: sweepResult.signature,
          gasUsed: sweepResult.gasFee,
          gasFee: new Decimal(sweepResult.gasFee).div(1e9),
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      console.log(`  ✅ Swept! Signature: ${sweepResult.signature}`);
    } else {
      result.error = 'Sweep failed';
    }
  } catch (error) {
    result.error = error.message;
    console.error(`  ❌ Error: ${error.message}`);
  }

  return result;
}

/**
 * Main function
 */
async function main() {
  const options = parseArgs();

  console.log('\n🧹 Existing Balance Sweep Script');
  console.log('================================');
  console.log(`Network: ${options.network}`);
  console.log(`Mode: ${options.dryRun ? 'DRY RUN' : 'LIVE'}`);

  if (options.dryRun) {
    console.log('\n⚠️  DRY RUN MODE - No transactions will be executed\n');
  }

  const results: SweepResult[] = [];

  // Sweep SUI wallets
  if (options.network === 'SUI' || options.network === 'ALL') {
    console.log('\n📍 Processing SUI wallets...');

    const suiHotWallet = configService.get<string>('blockchain.suiHotWallet');
    if (!suiHotWallet) {
      console.error('❌ SUI hot wallet not configured!');
      process.exit(1);
    }

    const suiService = new SuiBlockchainService(configService);
    if (!suiService.isConfigured()) {
      console.error('❌ SUI service not configured!');
      process.exit(1);
    }

    const suiWallets = await getWalletsToSweep('SUI');

    for (const wallet of suiWallets) {
      console.log(`\n  Wallet: ${wallet.depositAddress}`);
      console.log(`  User: ${wallet.user.email}`);
      console.log(`  Token: ${wallet.stablecoinType}`);

      const result = await sweepSuiWallet(
        suiService,
        wallet,
        suiHotWallet,
        options.dryRun,
      );
      results.push(result);

      // Wait 2 seconds between sweeps to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  // Sweep Solana wallets
  if (options.network === 'SOLANA' || options.network === 'ALL') {
    console.log('\n📍 Processing Solana wallets...');

    const solanaHotWallet = configService.get<string>(
      'blockchain.solanaHotWallet',
    );
    if (!solanaHotWallet) {
      console.error('❌ Solana hot wallet not configured!');
      process.exit(1);
    }

    const solanaService = new SolanaBlockchainService(configService);
    if (!solanaService.isConfigured()) {
      console.error('❌ Solana service not configured!');
      process.exit(1);
    }

    const solanaWallets = await getWalletsToSweep('SOLANA');

    for (const wallet of solanaWallets) {
      console.log(`\n  Wallet: ${wallet.depositAddress}`);
      console.log(`  User: ${wallet.user.email}`);
      console.log(`  Token: ${wallet.stablecoinType}`);

      const result = await sweepSolanaWallet(
        solanaService,
        wallet,
        solanaHotWallet,
        options.dryRun,
      );
      results.push(result);

      // Wait 2 seconds between sweeps to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  // Print summary
  console.log('\n\n📊 Sweep Summary');
  console.log('================');

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);
  const zeroBalance = results.filter((r) => r.error === 'Zero balance');
  const swept = results.filter(
    (r) => r.success && r.error !== 'DRY RUN - not executed',
  );

  console.log(`\nTotal wallets checked: ${results.length}`);
  console.log(`  ✅ Successful sweeps: ${swept.length}`);
  console.log(`  💤 Zero balance: ${zeroBalance.length}`);
  console.log(`  ❌ Failed: ${failed.filter((r) => r.error !== 'Zero balance').length}`);

  if (swept.length > 0) {
    const totalSwept = swept.reduce(
      (sum, r) => sum.add(new Decimal(r.amount)),
      new Decimal(0),
    );
    console.log(`\n💰 Total amount swept: ${totalSwept.toString()}`);
  }

  if (failed.length > 0 && !options.dryRun) {
    console.log('\n❌ Failed Sweeps:');
    failed.forEach((r) => {
      if (r.error !== 'Zero balance') {
        console.log(`  - ${r.depositAddress}: ${r.error}`);
      }
    });
  }

  console.log('\n✨ Done!\n');
}

// Run the script
main()
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
