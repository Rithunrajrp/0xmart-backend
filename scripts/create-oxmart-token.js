const {
  Connection,
  Keypair,
  PublicKey,
  clusterApiUrl,
} = require('@solana/web3.js');
const {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} = require('@solana/spl-token');
const fs = require('fs');
const path = require('path');

async function createOxmartToken() {
  try {
    console.log('🚀 Starting OXMART Token Creation on Solana Devnet...\n');

    // Connect to devnet
    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
    console.log('✅ Connected to Solana devnet');

    // Generate or load keypair
    const keypairPath = path.join(__dirname, 'solana-deployer-keypair.json');
    let payer;

    if (fs.existsSync(keypairPath)) {
      console.log('📂 Loading existing keypair...');
      const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
      payer = Keypair.fromSecretKey(Uint8Array.from(keypairData));
    } else {
      console.log('🔑 Generating new keypair...');
      payer = Keypair.generate();
      fs.writeFileSync(
        keypairPath,
        JSON.stringify(Array.from(payer.secretKey)),
      );
      console.log('💾 Keypair saved to:', keypairPath);
    }

    console.log('💳 Wallet Address:', payer.publicKey.toBase58());

    // Check balance
    const balance = await connection.getBalance(payer.publicKey);
    console.log(
      '💰 Current Balance:',
      balance / 1_000_000_000,
      'SOL',
    );

    if (balance < 1_000_000) {
      console.log(
        '\n⚠️  Insufficient balance! Please airdrop some SOL to your wallet:',
      );
      console.log(`   solana airdrop 2 ${payer.publicKey.toBase58()} --url devnet`);
      console.log('   OR visit: https://faucet.solana.com/');
      console.log('   Wallet:', payer.publicKey.toBase58());
      return;
    }

    // Create token mint
    console.log('\n🪙 Creating OXMART Token Mint...');
    const mint = await createMint(
      connection,
      payer, // Payer
      payer.publicKey, // Mint authority
      null, // Freeze authority (set to null for flexibility)
      9, // Decimals (9 is standard for Solana)
    );

    console.log('✅ Token Mint Created!');
    console.log('🎯 Mint Address:', mint.toBase58());

    // Get or create associated token account
    console.log('\n📦 Creating Token Account...');
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      mint,
      payer.publicKey,
    );

    console.log('✅ Token Account Created!');
    console.log('📍 Token Account Address:', tokenAccount.address.toBase58());

    // Mint 10,000,000 tokens
    const totalSupply = 10_000_000;
    const decimals = 9;
    const amount = totalSupply * Math.pow(10, decimals);

    console.log(`\n💎 Minting ${totalSupply.toLocaleString()} OXMART tokens...`);
    const signature = await mintTo(
      connection,
      payer,
      mint,
      tokenAccount.address,
      payer.publicKey,
      amount,
    );

    console.log('✅ Tokens Minted Successfully!');
    console.log('📝 Transaction Signature:', signature);
    console.log(
      `🔗 View on Solscan: https://solscan.io/tx/${signature}?cluster=devnet`,
    );

    // Save token info
    const tokenInfo = {
      name: '0xMart Token',
      symbol: 'OXMART',
      decimals: 9,
      totalSupply: totalSupply,
      mintAddress: mint.toBase58(),
      tokenAccount: tokenAccount.address.toBase58(),
      deployer: payer.publicKey.toBase58(),
      network: 'devnet',
      createdAt: new Date().toISOString(),
      transactionSignature: signature,
      solscanUrl: `https://solscan.io/token/${mint.toBase58()}?cluster=devnet`,
    };

    const infoPath = path.join(__dirname, 'oxmart-token-info.json');
    fs.writeFileSync(infoPath, JSON.stringify(tokenInfo, null, 2));

    console.log('\n📄 Token information saved to:', infoPath);
    console.log('\n🎉 OXMART Token Creation Complete!');
    console.log('\n📊 Token Summary:');
    console.log('   Name: 0xMart Token');
    console.log('   Symbol: OXMART');
    console.log('   Total Supply:', totalSupply.toLocaleString(), 'OXMART');
    console.log('   Decimals:', decimals);
    console.log('   Mint Address:', mint.toBase58());
    console.log('   Network: Solana Devnet');
    console.log(
      `   Solscan: https://solscan.io/token/${mint.toBase58()}?cluster=devnet`,
    );

    console.log('\n📝 Next Steps:');
    console.log('   1. Add metadata to the token (name, symbol, logo)');
    console.log('   2. Create liquidity pools on Raydium');
    console.log('   3. Integrate Jupiter swap in frontend');
    console.log('   4. Deploy to mainnet when ready');

    return tokenInfo;
  } catch (error) {
    console.error('\n❌ Error creating token:', error);
    throw error;
  }
}

// Run the script
if (require.main === module) {
  createOxmartToken()
    .then(() => {
      console.log('\n✨ Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error.message);
      process.exit(1);
    });
}

module.exports = { createOxmartToken };
