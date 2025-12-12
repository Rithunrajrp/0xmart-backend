const { ethers } = require("hardhat");

async function main() {
  console.log("🔐 Generating new Ethereum wallet for testnet deployment...\n");

  // Generate random wallet
  const wallet = ethers.Wallet.createRandom();

  console.log("✅ Wallet Generated!\n");
  console.log("================================================");
  console.log("⚠️  SAVE THESE CREDENTIALS SECURELY!");
  console.log("⚠️  NEVER share your private key!");
  console.log("⚠️  This wallet is for TESTNET ONLY!");
  console.log("================================================\n");

  console.log("Address (Public):", wallet.address);
  console.log("\nPrivate Key (Keep Secret!):", wallet.privateKey);
  console.log("\nMnemonic (24 words - Keep Secret!):");
  console.log(wallet.mnemonic.phrase);
  console.log("\n================================================\n");

  console.log("📋 Next Steps:");
  console.log("1. Save the private key in your .env file as DEPLOYER_PRIVATE_KEY");
  console.log("2. Use the address to get testnet ETH from faucets");
  console.log("3. You can also use this address as HOT_WALLET_ADDRESS\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
