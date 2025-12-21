const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Starting deployment...\n");

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
  console.log("Deploying OxMartPayment contract...\n");

  // Deploy contract
  const OxMartPayment = await ethers.getContractFactory("OxMartPayment");
  // Deploy contract with manual gas limit to avoid estimation errors on testnet
  // 10 Gwei gas price, 5M gas limit
  const contract = await OxMartPayment.deploy(hotWalletAddress, {
    gasLimit: 5000000,
    gasPrice: 10000000000n
  });

  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  console.log("✅ OxMartPayment deployed to:", contractAddress);

  // Get network info
  const network = await ethers.provider.getNetwork();
  console.log("Network:", network.name);
  console.log("Chain ID:", network.chainId.toString());

  // Save deployment info
  const deploymentInfo = {
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

  const filename = `${network.name}-${network.chainId}.json`;
  const filepath = path.join(deploymentsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));

  console.log("\n📄 Deployment info saved to:", filepath);

  // Print token addresses to add
  console.log("\n⚠️  IMPORTANT: Add supported tokens after deployment!");
  console.log("Use the following commands:");
  console.log(`\nconst contract = await ethers.getContractAt("OxMartPayment", "${contractAddress}");`);
  console.log("\n// Example token addresses (update with actual addresses for your network):");
  console.log('await contract.addSupportedToken("0x...USDT_ADDRESS");');
  console.log('await contract.addSupportedToken("0x...USDC_ADDRESS");');
  console.log('await contract.addSupportedToken("0x...DAI_ADDRESS");');
  console.log('await contract.addSupportedToken("0x...BUSD_ADDRESS");');

  console.log("\n✨ Deployment complete!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
