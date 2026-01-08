const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Starting PaymentProcessor deployment...\n");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH\n");

  // Get hot wallet address from environment
  const hotWalletAddress = process.env.HOT_WALLET_ADDRESS;
  if (!hotWalletAddress) {
    throw new Error("HOT_WALLET_ADDRESS environment variable not set");
  }

  console.log("Hot Wallet Address:", hotWalletAddress);
  console.log("Deploying PaymentProcessor contract...\n");

  // Deploy contract
  const PaymentProcessor = await ethers.getContractFactory("PaymentProcessor");

  // Deploy contract with manual gas limit to avoid estimation errors on testnet
  const contract = await PaymentProcessor.deploy(hotWalletAddress, {
    gasLimit: 5000000,
  });

  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  console.log("✅ PaymentProcessor deployed to:", contractAddress);

  // Get network info
  const network = await ethers.provider.getNetwork();
  console.log("Network:", network.name);
  console.log("Chain ID:", network.chainId.toString());

  // Save deployment info
  const deploymentInfo = {
    contractName: "PaymentProcessor",
    network: network.name,
    chainId: network.chainId.toString(),
    contractAddress: contractAddress,
    hotWalletAddress: hotWalletAddress,
    deployer: deployer.address,
    deploymentTime: new Date().toISOString(),
    blockNumber: await ethers.provider.getBlockNumber(),
  };

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const filename = `PaymentProcessor-${network.name}-${network.chainId}.json`;
  const filepath = path.join(deploymentsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));

  console.log("\n📄 Deployment info saved to:", filepath);
  console.log("\n✨ Deployment complete!\n");

  // Return contract address for scripting
  return contractAddress;
}

// If run directly, execute main
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { main };
