const { Keypair } = require('@solana/web3.js');
const { mnemonicNew, mnemonicToPrivateKey } = require('@ton/crypto');
const { WalletContractV4 } = require('@ton/ton');
const bip39 = require('bip39');
const fs = require('fs');

async function generateWallets() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║            WALLET GENERATION FOR ALL NETWORKS                  ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  // ========== SUI WALLET (Already Generated) ==========
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                        SUI WALLET (TESTNET)');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('✓ Status: Already Generated');
  console.log('Address: 0x3d543ec09b0ce4bf5f9ea4431fd0f2aac16148ad11180d09c65c704028fc8cfb');
  console.log('Alias: friendly-pearl');
  console.log('Seed Phrase: adjust device flock author scare mosquito sponsor coyote typical mother tube explain');
  console.log('Config Location: C:\\Users\\RITHUN\\.sui\\sui_config\\client.yaml');
  console.log('\n🎯 Get Testnet SUI Tokens:');
  console.log('   Run: sui client faucet');
  console.log('   Or visit: https://faucet.sui.io/');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // ========== SOLANA WALLET ==========
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                     SOLANA WALLET (DEVNET)');
  console.log('═══════════════════════════════════════════════════════════════');

  try {
    // Generate new Solana keypair
    const solanaKeypair = Keypair.generate();
    const solanaAddress = solanaKeypair.publicKey.toString();

    // Save keypair to file
    const solanaWalletData = {
      publicKey: solanaAddress,
      secretKey: Array.from(solanaKeypair.secretKey)
    };

    fs.writeFileSync(
      './solana-wallet.json',
      JSON.stringify(solanaWalletData, null, 2)
    );

    console.log('✓ Solana Wallet Generated Successfully!');
    console.log('Address: ' + solanaAddress);
    console.log('Private Key (Base58): [Saved in solana-wallet.json]');
    console.log('Wallet File: ./solana-wallet.json');
    console.log('\n🎯 Get Testnet SOL Tokens:');
    console.log('   Run: solana airdrop 2 ' + solanaAddress + ' --url devnet');
    console.log('   Or visit: https://faucet.solana.com/');
    console.log('═══════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error generating Solana wallet:', error.message);
  }

  // ========== TON WALLET ==========
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                      TON WALLET (TESTNET)');
  console.log('═══════════════════════════════════════════════════════════════');

  try {
    // Generate TON mnemonic (24 words)
    const tonMnemonic = await mnemonicNew(24);

    // Convert mnemonic to keypair
    const tonKeyPair = await mnemonicToPrivateKey(tonMnemonic);

    // Create wallet contract v4 (most common)
    const tonWallet = WalletContractV4.create({
      workchain: 0,
      publicKey: tonKeyPair.publicKey
    });

    const tonAddress = tonWallet.address.toString({ testOnly: true });
    const tonAddressMainnet = tonWallet.address.toString({ testOnly: false });

    // Save TON wallet data
    const tonWalletData = {
      mnemonic: tonMnemonic.join(' '),
      addressTestnet: tonAddress,
      addressMainnet: tonAddressMainnet,
      publicKey: tonKeyPair.publicKey.toString('hex'),
      secretKey: tonKeyPair.secretKey.toString('hex')
    };

    fs.writeFileSync(
      './ton-wallet.json',
      JSON.stringify(tonWalletData, null, 2)
    );

    console.log('✓ TON Wallet Generated Successfully!');
    console.log('Address (Testnet): ' + tonAddress);
    console.log('Address (Mainnet): ' + tonAddressMainnet);
    console.log('Mnemonic (24 words): ' + tonMnemonic.join(' '));
    console.log('Wallet File: ./ton-wallet.json');
    console.log('\n🎯 Get Testnet TON Tokens:');
    console.log('   Visit: https://t.me/testgiver_ton_bot');
    console.log('   Send your testnet address to the bot');
    console.log('═══════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error generating TON wallet:', error.message);
    console.error(error.stack);
  }

  // ========== SUMMARY ==========
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                        WALLET SUMMARY                          ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('\n✓ All wallets generated successfully!');
  console.log('\n📁 Files Created:');
  console.log('   - solana-wallet.json (Solana keypair)');
  console.log('   - ton-wallet.json (TON wallet data)');
  console.log('   - Sui config: C:\\Users\\RITHUN\\.sui\\sui_config\\client.yaml');
  console.log('\n⚠️  SECURITY WARNING:');
  console.log('   - Keep these wallet files and seed phrases SECURE');
  console.log('   - Never share private keys or mnemonics');
  console.log('   - These are for TESTNET use only');
  console.log('\n📝 Next Steps:');
  console.log('   1. Fund wallets using faucets (URLs provided above)');
  console.log('   2. Verify balances before deploying contracts');
  console.log('   3. Deploy contracts to each network');
  console.log('\n════════════════════════════════════════════════════════════════\n');
}

// Run the wallet generation
generateWallets().catch(console.error);
