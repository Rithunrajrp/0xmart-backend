const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Token addresses for different networks
// These should be updated with actual addresses for each network
const TOKEN_ADDRESSES = {
  // Ethereum Mainnet
  "1": {
    USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    BUSD: "0x4Fabb145d64652a948d72533023f6E7A623C7C53",
  },
  // Polygon Mainnet
  "137": {
    USDT: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    USDC: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    DAI: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
    BUSD: "0xdAb529f40E671A1D4bF91361c21bf9f0C9712ab7",
  },
  // BSC Mainnet
  "56": {
    USDT: "0x55d398326f99059fF775485246999027B3197955",
    USDC: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    DAI: "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3",
    BUSD: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56",
  },
  // Arbitrum Mainnet
  "42161": {
    USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    USDC: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",
    DAI: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
    BUSD: "0x", // Not available on Arbitrum
  },
  // Optimism Mainnet
  "10": {
    USDT: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
    USDC: "0x7F5c764cBc14f9669B88837ca1490cCa17c31607",
    DAI: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
    BUSD: "0x", // Not available on Optimism
  },
  // Avalanche C-Chain
  "43114": {
    USDT: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7",
    USDC: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
    DAI: "0xd586E7F844cEa2F87f50152665BCbc2C279D8d70",
    BUSD: "0x", // Not available on Avalanche
  },
  // Base Mainnet
  "8453": {
    USDT: "0x", // Not available yet
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    DAI: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
    BUSD: "0x", // Not available on Base
  },
  // Ethereum Sepolia (Testnet)
  "11155111": {
    USDT: "0x", // Add testnet addresses
    USDC: "0x",
    DAI: "0x",
    BUSD: "0x",
  },
  // Polygon Mumbai (Testnet)
  "80001": {
    USDT: "0x",
    USDC: "0x",
    DAI: "0x",
    BUSD: "0x",
  },
  // BSC Testnet
  "97": {
    USDT: "0x",
    USDC: "0x",
    DAI: "0x",
    BUSD: "0x",
  },
};

async function main() {
  console.log("Adding supported tokens to OxMartPayment contract...\n");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Using account:", deployer.address);

  // Get network info
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId.toString();
  console.log("Network:", network.name);
  console.log("Chain ID:", chainId, "\n");

  // Load deployment info
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  const filename = `${network.name}-${chainId}.json`;
  const filepath = path.join(deploymentsDir, filename);

  if (!fs.existsSync(filepath)) {
    throw new Error(`Deployment file not found: ${filepath}`);
  }

  const deploymentInfo = JSON.parse(fs.readFileSync(filepath, "utf-8"));
  const contractAddress = deploymentInfo.contractAddress;

  console.log("Contract address:", contractAddress, "\n");

  // Get contract instance
  const contract = await ethers.getContractAt("OxMartPayment", contractAddress);

  // Get token addresses for this chain
  const tokens = TOKEN_ADDRESSES[chainId];
  if (!tokens) {
    console.log("⚠️  No token addresses configured for chain ID:", chainId);
    console.log("Please update TOKEN_ADDRESSES in this script and try again.");
    return;
  }

  // Add each token
  for (const [symbol, address] of Object.entries(tokens)) {
    if (!address || address === "0x") {
      console.log(`⏭️  Skipping ${symbol} (no address configured)`);
      continue;
    }

    try {
      // Check if token is already supported
      const isSupported = await contract.supportedTokens(address);
      if (isSupported) {
        console.log(`✅ ${symbol} already supported:`, address);
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
  for (const [symbol, address] of Object.entries(tokens)) {
    if (!address || address === "0x") continue;
    try {
      const isSupported = await contract.supportedTokens(address);
      console.log(`${symbol} (${address}):`, isSupported ? "✅ Supported" : "❌ Not supported");
    } catch (error) {
      console.log(`${symbol}:`, "❌ Error checking");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
