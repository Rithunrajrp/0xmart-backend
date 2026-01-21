/**
 * Solana Deployment Script using Private Key from Environment
 *
 * This script deploys the 0xMart Payment Program to Solana using
 * the SOLANA_DEPLOYER_PRIVATE_KEY environment variable.
 *
 * Required Environment Variables:
 * - SOLANA_DEPLOYER_PRIVATE_KEY: Base58-encoded private key
 * - SOLANA_HOT_WALLET_ADDRESS: Hot wallet address (receives payments)
 * - SOLANA_CLUSTER: devnet, testnet, or mainnet-beta (default: devnet)
 *
 * Usage:
 * npx ts-node scripts/deploy-from-private-key.ts
 */

import { Keypair, Connection, PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { OxmartPayment } from '../target/types/oxmart_payment';
import bs58 from 'bs58';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

interface DeploymentConfig {
  deployer: Keypair;
  hotWallet: PublicKey;
  cluster: string;
  rpcUrl: string;
}

/**
 * Load configuration from environment variables
 */
function loadConfig(): DeploymentConfig {
  // Get private key from environment
  const privateKeyBase58 = process.env.SOLANA_DEPLOYER_PRIVATE_KEY;
  if (!privateKeyBase58) {
    throw new Error(
      'SOLANA_DEPLOYER_PRIVATE_KEY environment variable not set.\n' +
      'Please set it to your base58-encoded private key.\n' +
      'Example: export SOLANA_DEPLOYER_PRIVATE_KEY="your_base58_key"'
    );
  }

  // Get hot wallet address
  const hotWalletAddress = process.env.SOLANA_HOT_WALLET_ADDRESS;
  if (!hotWalletAddress) {
    throw new Error(
      'SOLANA_HOT_WALLET_ADDRESS environment variable not set.\n' +
      'Please set it to the address that will receive payments.\n' +
      'Example: export SOLANA_HOT_WALLET_ADDRESS="HotWalletPublicKey..."'
    );
  }

  // Get cluster (default to devnet)
  const cluster = process.env.SOLANA_CLUSTER || 'devnet';

  // Determine RPC URL based on cluster
  const rpcUrls: Record<string, string> = {
    'devnet': process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
    'testnet': process.env.SOLANA_RPC_URL || 'https://api.testnet.solana.com',
    'mainnet-beta': process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
  };

  const rpcUrl = rpcUrls[cluster];
  if (!rpcUrl) {
    throw new Error(`Invalid cluster: ${cluster}. Must be devnet, testnet, or mainnet-beta`);
  }

  // Create deployer keypair from private key
  let deployer: Keypair;
  try {
    const secretKey = bs58.decode(privateKeyBase58);
    deployer = Keypair.fromSecretKey(secretKey);
  } catch (error) {
    throw new Error(
      'Failed to decode SOLANA_DEPLOYER_PRIVATE_KEY.\n' +
      'Make sure it is a valid base58-encoded private key.\n' +
      `Error: ${error}`
    );
  }

  // Parse hot wallet address
  let hotWallet: PublicKey;
  try {
    hotWallet = new PublicKey(hotWalletAddress);
  } catch (error) {
    throw new Error(
      'Invalid SOLANA_HOT_WALLET_ADDRESS.\n' +
      'Make sure it is a valid Solana public key.\n' +
      `Error: ${error}`
    );
  }

  return {
    deployer,
    hotWallet,
    cluster,
    rpcUrl,
  };
}

/**
 * Create temporary keypair file for Anchor deployment
 */
function createTempKeypairFile(keypair: Keypair): string {
  const tempDir = path.join(__dirname, '..', '.temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const keypairPath = path.join(tempDir, 'deployer-keypair.json');
  fs.writeFileSync(
    keypairPath,
    JSON.stringify(Array.from(keypair.secretKey))
  );

  return keypairPath;
}

/**
 * Clean up temporary files
 */
function cleanup(keypairPath: string) {
  if (fs.existsSync(keypairPath)) {
    fs.unlinkSync(keypairPath);
    console.log('🧹 Cleaned up temporary keypair file');
  }
}

/**
 * Check deployer balance
 */
async function checkBalance(
  connection: Connection,
  publicKey: PublicKey
): Promise<number> {
  const balance = await connection.getBalance(publicKey);
  const solBalance = balance / 1e9;
  return solBalance;
}

/**
 * Deploy the program using Anchor CLI
 */
function deployProgram(keypairPath: string, cluster: string): void {
  console.log('\n📦 Building program...');
  execSync('anchor build', { stdio: 'inherit' });

  console.log(`\n🚀 Deploying to ${cluster}...`);
  const deployCommand = `anchor deploy --provider.cluster ${cluster} --provider.wallet ${keypairPath}`;
  execSync(deployCommand, { stdio: 'inherit' });
}

/**
 * Initialize the program after deployment
 */
async function initializeProgram(
  config: DeploymentConfig,
  programId: PublicKey
): Promise<void> {
  console.log('\n⚙️  Initializing program...');

  // Setup provider
  const connection = new Connection(config.rpcUrl, 'confirmed');
  const wallet = new anchor.Wallet(config.deployer);
  const provider = new anchor.AnchorProvider(
    connection,
    wallet,
    { commitment: 'confirmed' }
  );

  anchor.setProvider(provider);

  // Load program
  const idl = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, '..', 'target', 'idl', 'oxmart_payment.json'),
      'utf-8'
    )
  );

  const program = new Program(idl, programId, provider) as Program<OxmartPayment>;

  // Find config PDA
  const [configPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('config')],
    program.programId
  );

  // Check if already initialized
  try {
    const configAccount = await program.account.config.fetch(configPDA);
    console.log('✅ Program already initialized');
    console.log('   Authority:', configAccount.authority.toBase58());
    console.log('   Hot Wallet:', configAccount.hotWallet.toBase58());
    console.log('   Platform Fee:', configAccount.platformFeeBps, 'bps');
    return;
  } catch (error) {
    // Not initialized yet, continue with initialization
    console.log('⏳ Initializing program configuration...');
  }

  // Initialize with 0% platform fee (can be updated later)
  const platformFeeBps = 0;

  try {
    const tx = await program.methods
      .initialize(config.hotWallet, platformFeeBps)
      .accounts({
        config: configPDA,
        authority: config.deployer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log('✅ Program initialized successfully!');
    console.log('   Transaction:', tx);
    console.log('   Config PDA:', configPDA.toBase58());
    console.log('   Authority:', config.deployer.publicKey.toBase58());
    console.log('   Hot Wallet:', config.hotWallet.toBase58());
    console.log('   Platform Fee:', platformFeeBps, 'bps (0%)');
  } catch (error) {
    console.error('❌ Failed to initialize program:', error);
    throw error;
  }
}

/**
 * Save deployment information
 */
function saveDeploymentInfo(
  programId: PublicKey,
  config: DeploymentConfig,
  configPDA: PublicKey
): void {
  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentInfo = {
    network: config.cluster,
    programId: programId.toBase58(),
    configPDA: configPDA.toBase58(),
    authority: config.deployer.publicKey.toBase58(),
    hotWallet: config.hotWallet.toBase58(),
    deployedAt: new Date().toISOString(),
  };

  const filename = `${config.cluster}.json`;
  const filepath = path.join(deploymentsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));

  console.log('\n📄 Deployment info saved to:', filepath);
}

/**
 * Main deployment function
 */
async function deploy() {
  console.log('🚀 0xMart Solana Payment Program Deployment\n');
  console.log('=' .repeat(60));

  let keypairPath = '';

  try {
    // Load configuration
    console.log('\n📋 Loading configuration...');
    const config = loadConfig();

    console.log('✅ Configuration loaded:');
    console.log('   Deployer:', config.deployer.publicKey.toBase58());
    console.log('   Hot Wallet:', config.hotWallet.toBase58());
    console.log('   Cluster:', config.cluster);
    console.log('   RPC URL:', config.rpcUrl);

    // Check balance
    console.log('\n💰 Checking deployer balance...');
    const connection = new Connection(config.rpcUrl, 'confirmed');
    const balance = await checkBalance(connection, config.deployer.publicKey);

    console.log(`   Balance: ${balance} SOL`);

    const requiredSol = config.cluster === 'mainnet-beta' ? 5 : 2;
    if (balance < requiredSol) {
      throw new Error(
        `Insufficient SOL for deployment.\n` +
        `   Required: ${requiredSol} SOL\n` +
        `   Available: ${balance} SOL\n` +
        `   Please fund the deployer account: ${config.deployer.publicKey.toBase58()}`
      );
    }

    // Create temporary keypair file
    console.log('\n🔑 Creating temporary keypair file...');
    keypairPath = createTempKeypairFile(config.deployer);
    console.log('   Keypair path:', keypairPath);

    // Deploy program
    deployProgram(keypairPath, config.cluster);

    // Get program ID
    const programKeypairPath = path.join(
      __dirname,
      '..',
      'target',
      'deploy',
      'oxmart_payment-keypair.json'
    );
    const programKeypair = Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(fs.readFileSync(programKeypairPath, 'utf-8')))
    );
    const programId = programKeypair.publicKey;

    console.log('\n✅ Program deployed successfully!');
    console.log('   Program ID:', programId.toBase58());

    // Initialize program
    await initializeProgram(config, programId);

    // Find config PDA for saving
    const [configPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('config')],
      programId
    );

    // Save deployment info
    saveDeploymentInfo(programId, config, configPDA);

    console.log('\n' + '='.repeat(60));
    console.log('🎉 Deployment completed successfully!\n');
    console.log('Next steps:');
    console.log('1. Update backend with program ID:', programId.toBase58());
    console.log('2. Test the program with a sample transaction');
    console.log('3. Verify deployment on Solana Explorer:');
    console.log(`   https://explorer.solana.com/address/${programId.toBase58()}?cluster=${config.cluster}`);
    console.log('');

  } catch (error) {
    console.error('\n❌ Deployment failed:', error);
    process.exit(1);
  } finally {
    // Clean up temporary files
    if (keypairPath) {
      cleanup(keypairPath);
    }
  }
}

// Run deployment
deploy().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
