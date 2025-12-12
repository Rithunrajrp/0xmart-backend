const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Adding supported tokens to OxMartPayment contract...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Using account:", deployer.address);

  const network = await ethers.provider.getNetwork();
  console.log("Network:", network.name);
  console.log("Chain ID:", network.chainId.toString(), "\n");

  // Read payment contract deployment
  const paymentDeploymentFile = path.join(
    __dirname,
    "..",
    "deployments",
    `${network.name}-${network.chainId}.json`
  );

  if (!fs.existsSync(paymentDeploymentFile)) {
    throw new Error(`Payment contract deployment file not found: ${paymentDeploymentFile}`);
  }

  const paymentDeployment = JSON.parse(fs.readFileSync(paymentDeploymentFile, "utf8"));
  const contractAddress = paymentDeployment.contractAddress;

  console.log("Contract address:", contractAddress, "\n");

  // Read token deployment
  const tokenDeploymentFile = path.join(
    __dirname,
    "..",
    "deployments",
    `mock-tokens-${network.name}-${network.chainId}.json`
  );

  if (!fs.existsSync(tokenDeploymentFile)) {
    throw new Error(`Token deployment file not found: ${tokenDeploymentFile}`);
  }

  const tokenDeployment = JSON.parse(fs.readFileSync(tokenDeploymentFile, "utf8"));
  const tokens = tokenDeployment.tokens;

  // Get contract instance
  const contract = await ethers.getContractAt("OxMartPayment", contractAddress);

  console.log("Adding tokens to contract...\n");

  // Add each token
  for (const [symbol, tokenInfo] of Object.entries(tokens)) {
    try {
      const address = tokenInfo.address;

      // Check if already added
      const isSupported = await contract.supportedTokens(address);
      if (isSupported) {
        console.log(`⏭️  ${symbol} already supported:`, address);
        continue;
      }

      // Add token
      console.log(`Adding ${symbol}:`, address);
      const tx = await contract.addSupportedToken(address);
      console.log("Transaction hash:", tx.hash);
      await tx.wait();
      console.log(`✅ ${symbol} added successfully\n`);
    } catch (error) {
      console.error(`❌ Failed to add ${symbol}:`, error.message, "\n");
    }
  }

  console.log("✨ Token configuration complete!\n");

  // Verify added tokens
  console.log("Verifying supported tokens:");
  console.log("════════════════════════════════════════════════");
  for (const [symbol, tokenInfo] of Object.entries(tokens)) {
    const address = tokenInfo.address;
    const isSupported = await contract.supportedTokens(address);
    const status = isSupported ? "✅ Supported" : "❌ Not supported";
    console.log(`${symbol}: ${status}`);
    console.log(`  Address: ${address}`);
    console.log(`  Decimals: ${tokenInfo.decimals}`);
  }
  console.log("════════════════════════════════════════════════\n");

  console.log("🎉 All tokens configured successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
