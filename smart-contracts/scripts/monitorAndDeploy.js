const { ethers } = require("hardhat");

async function checkBalance() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  return {
    address: deployer.address,
    balance: balance,
    balanceEth: ethers.formatEther(balance),
  };
}

async function monitorWallet() {
  console.log("👀 Monitoring wallet for testnet ETH...\n");

  const { address, balance, balanceEth } = await checkBalance();

  console.log("Wallet Address:", address);
  console.log("Current Balance:", balanceEth, "ETH");

  const network = await ethers.provider.getNetwork();
  console.log("Network:", network.name);
  console.log("Chain ID:", network.chainId.toString());

  console.log("\n" + "=".repeat(60));
  console.log("⏳ Waiting for testnet ETH to arrive...");
  console.log("=".repeat(60));
  console.log("\n📋 Please visit one of these faucets:");
  console.log("   1. https://www.alchemy.com/faucets/ethereum-sepolia");
  console.log("   2. https://faucet.quicknode.com/ethereum/sepolia");
  console.log("   3. https://sepolia-faucet.pk910.de/");
  console.log("\nPaste your address:", address);
  console.log("\n" + "=".repeat(60) + "\n");

  // Minimum balance needed (approximately 0.001 ETH for deployment)
  const minBalance = ethers.parseEther("0.001");

  let checkCount = 0;
  const maxChecks = 120; // Check for 10 minutes (120 * 5 seconds)

  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      checkCount++;

      try {
        const { balance, balanceEth } = await checkBalance();

        // Show progress indicator
        process.stdout.write(`\rChecking... [${checkCount}/${maxChecks}] Balance: ${balanceEth} ETH `);

        if (balance >= minBalance) {
          console.log("\n\n✅ Testnet ETH received!");
          console.log("Balance:", balanceEth, "ETH");
          console.log("\n🚀 Proceeding with deployment...\n");
          clearInterval(interval);
          resolve({ balance, balanceEth });
        } else if (checkCount >= maxChecks) {
          console.log("\n\n⏰ Timeout reached. No funds received yet.");
          console.log("Please request testnet ETH and run the deployment manually:");
          console.log("\n  npm run deploy:sepolia\n");
          clearInterval(interval);
          reject(new Error("Timeout waiting for funds"));
        }
      } catch (error) {
        console.error("\n❌ Error checking balance:", error.message);
        clearInterval(interval);
        reject(error);
      }
    }, 5000); // Check every 5 seconds
  });
}

async function deployContract() {
  console.log("Starting deployment...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH\n");

  const hotWalletAddress = process.env.HOT_WALLET_ADDRESS;
  if (!hotWalletAddress) {
    throw new Error("HOT_WALLET_ADDRESS environment variable not set");
  }

  console.log("Hot Wallet Address:", hotWalletAddress);
  console.log("Deploying OxMartPayment contract...\n");

  const OxMartPayment = await ethers.getContractFactory("OxMartPayment");
  const contract = await OxMartPayment.deploy(hotWalletAddress);

  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  console.log("✅ OxMartPayment deployed to:", contractAddress);

  const network = await ethers.provider.getNetwork();
  console.log("Network:", network.name);
  console.log("Chain ID:", network.chainId.toString());

  return {
    contractAddress,
    network: network.name,
    chainId: network.chainId.toString(),
    deployer: deployer.address,
    hotWallet: hotWalletAddress,
  };
}

async function main() {
  console.log("🎯 0xMart Smart Contract Deployment Monitor\n");

  try {
    // Check current balance
    const { balance, balanceEth } = await checkBalance();
    const minBalance = ethers.parseEther("0.001");

    if (balance >= minBalance) {
      console.log("✅ Sufficient balance detected:", balanceEth, "ETH");
      console.log("🚀 Proceeding with deployment immediately...\n");

      const deploymentInfo = await deployContract();

      console.log("\n" + "=".repeat(60));
      console.log("🎉 Deployment Successful!");
      console.log("=".repeat(60));
      console.log("\nContract Address:", deploymentInfo.contractAddress);
      console.log("Network:", deploymentInfo.network);
      console.log("Chain ID:", deploymentInfo.chainId);
      console.log("\n📋 Next Steps:");
      console.log("   1. Deploy mock tokens: npm run deploy:tokens");
      console.log("   2. Add tokens to contract: npm run tokens:sepolia");
      console.log("   3. Verify contract on Etherscan (optional)");
      console.log("\n🔗 View on Etherscan:");
      console.log(`   https://sepolia.etherscan.io/address/${deploymentInfo.contractAddress}`);
      console.log("\n" + "=".repeat(60) + "\n");
    } else {
      console.log("⚠️  Insufficient balance:", balanceEth, "ETH");
      console.log("Required: 0.001 ETH minimum\n");

      // Start monitoring
      await monitorWallet();

      // Once funds arrive, deploy
      const deploymentInfo = await deployContract();

      console.log("\n" + "=".repeat(60));
      console.log("🎉 Deployment Successful!");
      console.log("=".repeat(60));
      console.log("\nContract Address:", deploymentInfo.contractAddress);
      console.log("\n🔗 View on Etherscan:");
      console.log(`   https://sepolia.etherscan.io/address/${deploymentInfo.contractAddress}`);
      console.log("\n" + "=".repeat(60) + "\n");
    }
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
