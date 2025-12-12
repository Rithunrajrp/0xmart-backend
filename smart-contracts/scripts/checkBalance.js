const { ethers } = require("hardhat");

async function main() {
  console.log("Checking deployer balance...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");

  const network = await ethers.provider.getNetwork();
  console.log("Network:", network.name);
  console.log("Chain ID:", network.chainId.toString());

  // Estimate deployment cost
  const estimatedGas = 2000000n; // Approximate gas for deployment
  const gasPrice = (await ethers.provider.getFeeData()).gasPrice || 0n;
  const estimatedCost = estimatedGas * gasPrice;

  console.log("\nEstimated deployment cost:", ethers.formatEther(estimatedCost), "ETH");
  console.log("Gas price:", ethers.formatUnits(gasPrice, "gwei"), "gwei");

  if (balance < estimatedCost) {
    console.log("\n⚠️  WARNING: Insufficient balance for deployment");
    console.log("Required:", ethers.formatEther(estimatedCost), "ETH");
    console.log("Current:", ethers.formatEther(balance), "ETH");
    console.log("Deficit:", ethers.formatEther(estimatedCost - balance), "ETH");
  } else {
    console.log("\n✅ Sufficient balance for deployment");
  }

  // Check hot wallet address
  const hotWalletAddress = process.env.HOT_WALLET_ADDRESS;
  if (hotWalletAddress) {
    console.log("\n🔥 Hot Wallet Address:", hotWalletAddress);
    const hotWalletBalance = await ethers.provider.getBalance(hotWalletAddress);
    console.log("Hot Wallet Balance:", ethers.formatEther(hotWalletBalance), "ETH");
  } else {
    console.log("\n⚠️  HOT_WALLET_ADDRESS not set in .env");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
