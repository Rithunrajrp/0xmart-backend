const { ethers } = require("hardhat");

// Testnet token addresses for Arbitrum Sepolia and Base Sepolia
const TOKEN_ADDRESSES = {
  arbitrumSepolia: {
    USDT: "0xfd064a18f3bf249cf1f87fc203e90d8f650f2d63", // Arbitrum Sepolia USDT
    USDC: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d", // Arbitrum Sepolia USDC
  },
  baseSepolia: {
    USDC: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // Base Sepolia USDC
  },
};

async function main() {
  const network = hre.network.name;
  console.log(`\n🔧 Adding supported tokens on ${network}...\n`);

  // Get contract address from deployment file
  const fs = require("fs");
  const path = require("path");
  const deploymentPath = path.join(
    __dirname,
    "..",
    "deployments",
    `${network}-${hre.network.config.chainId}.json`
  );

  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`Deployment file not found: ${deploymentPath}`);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const contractAddress = deployment.contractAddress;

  console.log("Contract Address:", contractAddress);
  console.log("Network:", network);
  console.log("Chain ID:", hre.network.config.chainId);

  // Get contract instance
  const contract = await ethers.getContractAt("OxMartPayment", contractAddress);

  // Get tokens for this network
  const tokens = TOKEN_ADDRESSES[network];
  if (!tokens) {
    console.log(`⚠️  No token addresses configured for ${network}`);
    return;
  }

  console.log("\n📝 Adding tokens...\n");

  for (const [symbol, address] of Object.entries(tokens)) {
    try {
      console.log(`Adding ${symbol} at ${address}...`);
      const tx = await contract.addSupportedToken(address);
      await tx.wait();
      console.log(`✅ ${symbol} added successfully`);
    } catch (error) {
      console.error(`❌ Failed to add ${symbol}:`, error.message);
    }
  }

  console.log("\n🎉 Token configuration complete!\n");

  // Verify tokens were added
  console.log("Verifying tokens...\n");
  for (const [symbol, address] of Object.entries(tokens)) {
    const isSupported = await contract.supportedTokens(address);
    console.log(`${symbol} (${address}): ${isSupported ? "✅ Supported" : "❌ Not supported"}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
