const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Deploying Mock ERC20 tokens for testing...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH\n");

  // Get network info
  const network = await ethers.provider.getNetwork();
  console.log("Network:", network.name);
  console.log("Chain ID:", network.chainId.toString(), "\n");

  // Deploy tokens
  const MockERC20 = await ethers.getContractFactory("MockERC20");

  // Gas overrides for reliable deployment
  const overrides = { gasLimit: 3000000, gasPrice: 10000000000n };

  console.log("Deploying USDT (6 decimals)...");
  const usdt = await MockERC20.deploy("Tether USD", "USDT", 6, overrides);
  await usdt.waitForDeployment();
  const usdtAddress = await usdt.getAddress();
  console.log("✅ USDT deployed to:", usdtAddress);

  console.log("\nDeploying USDC (6 decimals)...");
  const usdc = await MockERC20.deploy("USD Coin", "USDC", 6, overrides);
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();
  console.log("✅ USDC deployed to:", usdcAddress);

  console.log("\nDeploying DAI (18 decimals)...");
  const dai = await MockERC20.deploy("Dai Stablecoin", "DAI", 18, overrides);
  await dai.waitForDeployment();
  const daiAddress = await dai.getAddress();
  console.log("✅ DAI deployed to:", daiAddress);

  console.log("\nDeploying BUSD (18 decimals)...");
  const busd = await MockERC20.deploy("Binance USD", "BUSD", 18, overrides);
  await busd.waitForDeployment();
  const busdAddress = await busd.getAddress();
  console.log("✅ BUSD deployed to:", busdAddress);

  // Save deployment info
  const deploymentInfo = {
    network: network.name,
    chainId: network.chainId.toString(),
    deployer: deployer.address,
    deploymentTime: new Date().toISOString(),
    tokens: {
      USDT: {
        address: usdtAddress,
        decimals: 6,
        symbol: "USDT",
        name: "Tether USD"
      },
      USDC: {
        address: usdcAddress,
        decimals: 6,
        symbol: "USDC",
        name: "USD Coin"
      },
      DAI: {
        address: daiAddress,
        decimals: 18,
        symbol: "DAI",
        name: "Dai Stablecoin"
      },
      BUSD: {
        address: busdAddress,
        decimals: 18,
        symbol: "BUSD",
        name: "Binance USD"
      }
    }
  };

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const filename = `mock-tokens-${network.name}-${network.chainId}.json`;
  const filepath = path.join(deploymentsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));

  console.log("\n📄 Token deployment info saved to:", filepath);

  // Mint some tokens to deployer for testing
  console.log("\nMinting test tokens to deployer...");
  const mintAmount6 = ethers.parseUnits("1000000", 6); // 1M USDT/USDC
  const mintAmount18 = ethers.parseUnits("1000000", 18); // 1M DAI/BUSD

  await usdt.mint(deployer.address, mintAmount6);
  console.log("✅ Minted 1,000,000 USDT");

  await usdc.mint(deployer.address, mintAmount6);
  console.log("✅ Minted 1,000,000 USDC");

  await dai.mint(deployer.address, mintAmount18);
  console.log("✅ Minted 1,000,000 DAI");

  await busd.mint(deployer.address, mintAmount18);
  console.log("✅ Minted 1,000,000 BUSD");

  console.log("\n📋 Summary:");
  console.log("════════════════════════════════════════════════");
  console.log("USDT:", usdtAddress);
  console.log("USDC:", usdcAddress);
  console.log("DAI: ", daiAddress);
  console.log("BUSD:", busdAddress);
  console.log("════════════════════════════════════════════════");

  console.log("\n💡 Next steps:");
  console.log("1. Add these token addresses to your OxMartPayment contract");
  console.log("2. Use addSupportedToken() for each address");
  console.log("3. Mint tokens to test users for payment testing");

  console.log("\n✨ Mock token deployment complete!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
