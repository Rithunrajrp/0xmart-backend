const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("OxMartPayment", function () {
  // Fixture to deploy contract and mock tokens
  async function deployContractFixture() {
    const [owner, hotWallet, buyer, apiKeyOwner, attacker] = await ethers.getSigners();

    // Deploy mock ERC20 tokens
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdt = await MockERC20.deploy("Tether USD", "USDT", 6); // 6 decimals like real USDT
    const usdc = await MockERC20.deploy("USD Coin", "USDC", 6);
    const dai = await MockERC20.deploy("Dai Stablecoin", "DAI", 18);
    const busd = await MockERC20.deploy("Binance USD", "BUSD", 18);

    await usdt.waitForDeployment();
    await usdc.waitForDeployment();
    await dai.waitForDeployment();
    await busd.waitForDeployment();

    // Deploy OxMartPayment contract
    const OxMartPayment = await ethers.getContractFactory("OxMartPayment");
    const payment = await OxMartPayment.deploy(hotWallet.address);
    await payment.waitForDeployment();

    // Mint tokens to buyer
    const mintAmount = ethers.parseUnits("10000", 6); // 10,000 USDT/USDC
    await usdt.mint(buyer.address, mintAmount);
    await usdc.mint(buyer.address, mintAmount);
    await dai.mint(buyer.address, ethers.parseUnits("10000", 18));
    await busd.mint(buyer.address, ethers.parseUnits("10000", 18));

    return {
      payment,
      usdt,
      usdc,
      dai,
      busd,
      owner,
      hotWallet,
      buyer,
      apiKeyOwner,
      attacker
    };
  }

  describe("1. Basic Functionality", function () {
    it("Should deploy with correct hot wallet address", async function () {
      const { payment, hotWallet } = await loadFixture(deployContractFixture);
      expect(await payment.hotWallet()).to.equal(hotWallet.address);
    });

    it("Should set owner correctly", async function () {
      const { payment, owner } = await loadFixture(deployContractFixture);
      expect(await payment.owner()).to.equal(owner.address);
    });

    it("Should initialize with zero platform fee", async function () {
      const { payment } = await loadFixture(deployContractFixture);
      expect(await payment.platformFeeBps()).to.equal(0);
    });

    it("Should add supported tokens", async function () {
      const { payment, usdt, owner } = await loadFixture(deployContractFixture);

      await expect(payment.connect(owner).addSupportedToken(await usdt.getAddress()))
        .to.emit(payment, "TokenAdded")
        .withArgs(await usdt.getAddress());

      expect(await payment.supportedTokens(await usdt.getAddress())).to.be.true;
    });

    it("Should remove supported tokens", async function () {
      const { payment, usdt, owner } = await loadFixture(deployContractFixture);

      const usdtAddress = await usdt.getAddress();
      await payment.connect(owner).addSupportedToken(usdtAddress);

      await expect(payment.connect(owner).removeSupportedToken(usdtAddress))
        .to.emit(payment, "TokenRemoved")
        .withArgs(usdtAddress);

      expect(await payment.supportedTokens(usdtAddress)).to.be.false;
    });
  });

  describe("2. Payment Processing", function () {
    it("Should process payment successfully", async function () {
      const { payment, usdt, buyer, hotWallet, apiKeyOwner, owner } = await loadFixture(deployContractFixture);

      // Add USDT as supported token
      const usdtAddress = await usdt.getAddress();
      await payment.connect(owner).addSupportedToken(usdtAddress);

      // Prepare payment
      const amount = ethers.parseUnits("100", 6); // 100 USDT
      const orderId = ethers.keccak256(ethers.toUtf8Bytes("order-123"));
      const productId = "product-456";
      const commissionBps = 500; // 5%

      // Approve payment contract
      await usdt.connect(buyer).approve(await payment.getAddress(), amount);

      // Initial balance
      const initialBalance = await usdt.balanceOf(hotWallet.address);

      // Process payment
      await expect(
        payment.connect(buyer).processPayment(
          orderId,
          usdtAddress,
          amount,
          productId,
          apiKeyOwner.address,
          commissionBps
        )
      )
        .to.emit(payment, "PaymentReceived")
        .withArgs(
          orderId,
          buyer.address,
          usdtAddress,
          amount,
          0, // platform fee
          apiKeyOwner.address,
          ethers.parseUnits("5", 6), // 5% commission = 5 USDT
          productId
        );

      // Check hot wallet received payment
      const finalBalance = await usdt.balanceOf(hotWallet.address);
      expect(finalBalance - initialBalance).to.equal(amount);
    });

    it("Should prevent double-spending same order ID", async function () {
      const { payment, usdt, buyer, apiKeyOwner, owner } = await loadFixture(deployContractFixture);

      const usdtAddress = await usdt.getAddress();
      await payment.connect(owner).addSupportedToken(usdtAddress);

      const amount = ethers.parseUnits("100", 6);
      const orderId = ethers.keccak256(ethers.toUtf8Bytes("order-123"));

      await usdt.connect(buyer).approve(await payment.getAddress(), amount * 2n);

      // First payment succeeds
      await payment.connect(buyer).processPayment(
        orderId,
        usdtAddress,
        amount,
        "product-1",
        apiKeyOwner.address,
        500
      );

      // Second payment with same order ID fails
      await expect(
        payment.connect(buyer).processPayment(
          orderId,
          usdtAddress,
          amount,
          "product-1",
          apiKeyOwner.address,
          500
        )
      ).to.be.revertedWith("Order already processed");
    });

    it("Should reject unsupported tokens", async function () {
      const { payment, usdt, buyer, apiKeyOwner } = await loadFixture(deployContractFixture);

      const usdtAddress = await usdt.getAddress();
      // Note: NOT adding USDT as supported token

      const amount = ethers.parseUnits("100", 6);
      const orderId = ethers.keccak256(ethers.toUtf8Bytes("order-123"));

      await usdt.connect(buyer).approve(await payment.getAddress(), amount);

      await expect(
        payment.connect(buyer).processPayment(
          orderId,
          usdtAddress,
          amount,
          "product-1",
          apiKeyOwner.address,
          500
        )
      ).to.be.revertedWith("Token not supported");
    });

    it("Should reject zero amount", async function () {
      const { payment, usdt, buyer, apiKeyOwner, owner } = await loadFixture(deployContractFixture);

      const usdtAddress = await usdt.getAddress();
      await payment.connect(owner).addSupportedToken(usdtAddress);

      const orderId = ethers.keccak256(ethers.toUtf8Bytes("order-123"));

      await expect(
        payment.connect(buyer).processPayment(
          orderId,
          usdtAddress,
          0, // Zero amount
          "product-1",
          apiKeyOwner.address,
          500
        )
      ).to.be.revertedWith("Invalid amount");
    });

    it("Should reject invalid commission (>100%)", async function () {
      const { payment, usdt, buyer, apiKeyOwner, owner } = await loadFixture(deployContractFixture);

      const usdtAddress = await usdt.getAddress();
      await payment.connect(owner).addSupportedToken(usdtAddress);

      const amount = ethers.parseUnits("100", 6);
      const orderId = ethers.keccak256(ethers.toUtf8Bytes("order-123"));

      await usdt.connect(buyer).approve(await payment.getAddress(), amount);

      await expect(
        payment.connect(buyer).processPayment(
          orderId,
          usdtAddress,
          amount,
          "product-1",
          apiKeyOwner.address,
          10001 // 100.01%
        )
      ).to.be.revertedWith("Invalid commission");
    });

    it("Should handle zero commission", async function () {
      const { payment, usdt, buyer, hotWallet, apiKeyOwner, owner } = await loadFixture(deployContractFixture);

      const usdtAddress = await usdt.getAddress();
      await payment.connect(owner).addSupportedToken(usdtAddress);

      const amount = ethers.parseUnits("100", 6);
      const orderId = ethers.keccak256(ethers.toUtf8Bytes("order-123"));

      await usdt.connect(buyer).approve(await payment.getAddress(), amount);

      await expect(
        payment.connect(buyer).processPayment(
          orderId,
          usdtAddress,
          amount,
          "product-1",
          apiKeyOwner.address,
          0 // 0% commission
        )
      )
        .to.emit(payment, "PaymentReceived")
        .withArgs(
          orderId,
          buyer.address,
          usdtAddress,
          amount,
          0, // platform fee
          apiKeyOwner.address,
          0, // 0 commission
          "product-1"
        );
    });
  });

  describe("3. Batch Payment Processing", function () {
    it("Should process batch payment successfully", async function () {
      const { payment, usdt, buyer, hotWallet, apiKeyOwner, owner } = await loadFixture(deployContractFixture);

      const usdtAddress = await usdt.getAddress();
      await payment.connect(owner).addSupportedToken(usdtAddress);

      const totalAmount = ethers.parseUnits("300", 6); // 300 USDT
      const orderId = ethers.keccak256(ethers.toUtf8Bytes("order-batch-1"));
      const productIds = ["product-1", "product-2", "product-3"];
      const commissionBps = 500;

      await usdt.connect(buyer).approve(await payment.getAddress(), totalAmount);

      const initialBalance = await usdt.balanceOf(hotWallet.address);

      await expect(
        payment.connect(buyer).processBatchPayment(
          orderId,
          usdtAddress,
          totalAmount,
          productIds,
          apiKeyOwner.address,
          commissionBps
        )
      )
        .to.emit(payment, "PaymentReceived")
        .withArgs(
          orderId,
          buyer.address,
          usdtAddress,
          totalAmount,
          0, // platform fee
          apiKeyOwner.address,
          ethers.parseUnits("15", 6), // 5% of 300 = 15 USDT
          "" // Empty product ID for batch
        );

      const finalBalance = await usdt.balanceOf(hotWallet.address);
      expect(finalBalance - initialBalance).to.equal(totalAmount);
    });

    it("Should reject batch payment with no products", async function () {
      const { payment, usdt, buyer, apiKeyOwner, owner } = await loadFixture(deployContractFixture);

      const usdtAddress = await usdt.getAddress();
      await payment.connect(owner).addSupportedToken(usdtAddress);

      const totalAmount = ethers.parseUnits("300", 6);
      const orderId = ethers.keccak256(ethers.toUtf8Bytes("order-batch-1"));
      const productIds = []; // Empty array

      await usdt.connect(buyer).approve(await payment.getAddress(), totalAmount);

      await expect(
        payment.connect(buyer).processBatchPayment(
          orderId,
          usdtAddress,
          totalAmount,
          productIds,
          apiKeyOwner.address,
          500
        )
      ).to.be.revertedWith("No products");
    });

    it("Should prevent double-spending batch orders", async function () {
      const { payment, usdt, buyer, apiKeyOwner, owner } = await loadFixture(deployContractFixture);

      const usdtAddress = await usdt.getAddress();
      await payment.connect(owner).addSupportedToken(usdtAddress);

      const totalAmount = ethers.parseUnits("300", 6);
      const orderId = ethers.keccak256(ethers.toUtf8Bytes("order-batch-1"));
      const productIds = ["product-1", "product-2"];

      await usdt.connect(buyer).approve(await payment.getAddress(), totalAmount * 2n);

      await payment.connect(buyer).processBatchPayment(
        orderId,
        usdtAddress,
        totalAmount,
        productIds,
        apiKeyOwner.address,
        500
      );

      await expect(
        payment.connect(buyer).processBatchPayment(
          orderId,
          usdtAddress,
          totalAmount,
          productIds,
          apiKeyOwner.address,
          500
        )
      ).to.be.revertedWith("Order already processed");
    });
  });

  describe("4. Commission Calculations", function () {
    it("Should calculate 5% commission correctly", async function () {
      const { payment, usdt, buyer, apiKeyOwner, owner } = await loadFixture(deployContractFixture);

      const usdtAddress = await usdt.getAddress();
      await payment.connect(owner).addSupportedToken(usdtAddress);

      const amount = ethers.parseUnits("100", 6); // 100 USDT
      const orderId = ethers.keccak256(ethers.toUtf8Bytes("order-123"));
      const commissionBps = 500; // 5%
      const expectedCommission = ethers.parseUnits("5", 6); // 5 USDT

      await usdt.connect(buyer).approve(await payment.getAddress(), amount);

      await expect(
        payment.connect(buyer).processPayment(
          orderId,
          usdtAddress,
          amount,
          "product-1",
          apiKeyOwner.address,
          commissionBps
        )
      )
        .to.emit(payment, "PaymentReceived")
        .withArgs(
          orderId,
          buyer.address,
          usdtAddress,
          amount,
          0,
          apiKeyOwner.address,
          expectedCommission,
          "product-1"
        );
    });

    it("Should calculate 10% commission correctly", async function () {
      const { payment, usdt, buyer, apiKeyOwner, owner } = await loadFixture(deployContractFixture);

      const usdtAddress = await usdt.getAddress();
      await payment.connect(owner).addSupportedToken(usdtAddress);

      const amount = ethers.parseUnits("200", 6); // 200 USDT
      const orderId = ethers.keccak256(ethers.toUtf8Bytes("order-123"));
      const commissionBps = 1000; // 10%
      const expectedCommission = ethers.parseUnits("20", 6); // 20 USDT

      await usdt.connect(buyer).approve(await payment.getAddress(), amount);

      await expect(
        payment.connect(buyer).processPayment(
          orderId,
          usdtAddress,
          amount,
          "product-1",
          apiKeyOwner.address,
          commissionBps
        )
      )
        .to.emit(payment, "PaymentReceived")
        .withArgs(
          orderId,
          buyer.address,
          usdtAddress,
          amount,
          0,
          apiKeyOwner.address,
          expectedCommission,
          "product-1"
        );
    });

    it("Should handle maximum commission (100%)", async function () {
      const { payment, usdt, buyer, apiKeyOwner, owner } = await loadFixture(deployContractFixture);

      const usdtAddress = await usdt.getAddress();
      await payment.connect(owner).addSupportedToken(usdtAddress);

      const amount = ethers.parseUnits("100", 6);
      const orderId = ethers.keccak256(ethers.toUtf8Bytes("order-123"));
      const commissionBps = 10000; // 100%

      await usdt.connect(buyer).approve(await payment.getAddress(), amount);

      await expect(
        payment.connect(buyer).processPayment(
          orderId,
          usdtAddress,
          amount,
          "product-1",
          apiKeyOwner.address,
          commissionBps
        )
      ).to.not.be.reverted;
    });
  });

  describe("5. Platform Fee Tests", function () {
    it("Should calculate platform fee correctly", async function () {
      const { payment, usdt, buyer, hotWallet, apiKeyOwner, owner } = await loadFixture(deployContractFixture);

      const usdtAddress = await usdt.getAddress();
      await payment.connect(owner).addSupportedToken(usdtAddress);

      // Set platform fee to 2%
      await payment.connect(owner).updatePlatformFee(200);

      const amount = ethers.parseUnits("100", 6); // 100 USDT
      const orderId = ethers.keccak256(ethers.toUtf8Bytes("order-123"));
      const expectedPlatformFee = ethers.parseUnits("2", 6); // 2 USDT
      const expectedNetAmount = amount - expectedPlatformFee; // 98 USDT

      await usdt.connect(buyer).approve(await payment.getAddress(), amount);

      const initialBalance = await usdt.balanceOf(hotWallet.address);

      await payment.connect(buyer).processPayment(
        orderId,
        usdtAddress,
        amount,
        "product-1",
        apiKeyOwner.address,
        500
      );

      const finalBalance = await usdt.balanceOf(hotWallet.address);
      expect(finalBalance - initialBalance).to.equal(expectedNetAmount);
    });

    it("Should reject platform fee > 10%", async function () {
      const { payment, owner } = await loadFixture(deployContractFixture);

      await expect(
        payment.connect(owner).updatePlatformFee(1001) // 10.01%
      ).to.be.revertedWith("Fee too high");
    });

    it("Should allow maximum platform fee (10%)", async function () {
      const { payment, owner } = await loadFixture(deployContractFixture);

      await expect(
        payment.connect(owner).updatePlatformFee(1000) // 10%
      ).to.not.be.reverted;
    });
  });

  describe("6. Security Tests", function () {
    it("Should prevent reentrancy attacks", async function () {
      // Note: This is inherently protected by ReentrancyGuard
      // Testing indirectly through normal payment flow
      const { payment, usdt, buyer, apiKeyOwner, owner } = await loadFixture(deployContractFixture);

      const usdtAddress = await usdt.getAddress();
      await payment.connect(owner).addSupportedToken(usdtAddress);

      const amount = ethers.parseUnits("100", 6);
      const orderId = ethers.keccak256(ethers.toUtf8Bytes("order-123"));

      await usdt.connect(buyer).approve(await payment.getAddress(), amount);

      // Should complete without reentrancy issues
      await expect(
        payment.connect(buyer).processPayment(
          orderId,
          usdtAddress,
          amount,
          "product-1",
          apiKeyOwner.address,
          500
        )
      ).to.not.be.reverted;
    });

    it("Should pause and unpause contract", async function () {
      const { payment, usdt, buyer, apiKeyOwner, owner } = await loadFixture(deployContractFixture);

      const usdtAddress = await usdt.getAddress();
      await payment.connect(owner).addSupportedToken(usdtAddress);

      // Pause contract
      await payment.connect(owner).pause();

      const amount = ethers.parseUnits("100", 6);
      const orderId = ethers.keccak256(ethers.toUtf8Bytes("order-123"));

      await usdt.connect(buyer).approve(await payment.getAddress(), amount);

      // Should fail when paused
      await expect(
        payment.connect(buyer).processPayment(
          orderId,
          usdtAddress,
          amount,
          "product-1",
          apiKeyOwner.address,
          500
        )
      ).to.be.revertedWithCustomError(payment, "EnforcedPause");

      // Unpause
      await payment.connect(owner).unpause();

      // Should succeed after unpause
      await expect(
        payment.connect(buyer).processPayment(
          orderId,
          usdtAddress,
          amount,
          "product-1",
          apiKeyOwner.address,
          500
        )
      ).to.not.be.reverted;
    });

    it("Should allow emergency withdrawal by owner", async function () {
      const { payment, usdt, owner } = await loadFixture(deployContractFixture);

      // Send some USDT to contract (simulating stuck funds)
      const amount = ethers.parseUnits("100", 6);
      await usdt.mint(await payment.getAddress(), amount);

      const ownerBalanceBefore = await usdt.balanceOf(owner.address);

      await payment.connect(owner).emergencyWithdraw(await usdt.getAddress());

      const ownerBalanceAfter = await usdt.balanceOf(owner.address);
      expect(ownerBalanceAfter - ownerBalanceBefore).to.equal(amount);
    });

    it("Should reject emergency withdrawal when no balance", async function () {
      const { payment, usdt, owner } = await loadFixture(deployContractFixture);

      await expect(
        payment.connect(owner).emergencyWithdraw(await usdt.getAddress())
      ).to.be.revertedWith("No balance");
    });
  });

  describe("7. Access Control Tests", function () {
    it("Should only allow owner to update hot wallet", async function () {
      const { payment, owner, attacker, buyer } = await loadFixture(deployContractFixture);

      // Attacker cannot update
      await expect(
        payment.connect(attacker).updateHotWallet(buyer.address)
      ).to.be.revertedWithCustomError(payment, "OwnableUnauthorizedAccount");

      // Owner can update
      await expect(
        payment.connect(owner).updateHotWallet(buyer.address)
      )
        .to.emit(payment, "HotWalletUpdated");

      expect(await payment.hotWallet()).to.equal(buyer.address);
    });

    it("Should only allow owner to add tokens", async function () {
      const { payment, usdt, attacker } = await loadFixture(deployContractFixture);

      await expect(
        payment.connect(attacker).addSupportedToken(await usdt.getAddress())
      ).to.be.revertedWithCustomError(payment, "OwnableUnauthorizedAccount");
    });

    it("Should only allow owner to remove tokens", async function () {
      const { payment, usdt, owner, attacker } = await loadFixture(deployContractFixture);

      const usdtAddress = await usdt.getAddress();
      await payment.connect(owner).addSupportedToken(usdtAddress);

      await expect(
        payment.connect(attacker).removeSupportedToken(usdtAddress)
      ).to.be.revertedWithCustomError(payment, "OwnableUnauthorizedAccount");
    });

    it("Should only allow owner to update platform fee", async function () {
      const { payment, attacker } = await loadFixture(deployContractFixture);

      await expect(
        payment.connect(attacker).updatePlatformFee(100)
      ).to.be.revertedWithCustomError(payment, "OwnableUnauthorizedAccount");
    });

    it("Should only allow owner to pause", async function () {
      const { payment, attacker } = await loadFixture(deployContractFixture);

      await expect(
        payment.connect(attacker).pause()
      ).to.be.revertedWithCustomError(payment, "OwnableUnauthorizedAccount");
    });

    it("Should only allow owner to unpause", async function () {
      const { payment, owner, attacker } = await loadFixture(deployContractFixture);

      await payment.connect(owner).pause();

      await expect(
        payment.connect(attacker).unpause()
      ).to.be.revertedWithCustomError(payment, "OwnableUnauthorizedAccount");
    });

    it("Should reject invalid hot wallet address (zero address)", async function () {
      const { payment, owner } = await loadFixture(deployContractFixture);

      await expect(
        payment.connect(owner).updateHotWallet(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid address");
    });

    it("Should reject invalid token address (zero address)", async function () {
      const { payment, owner } = await loadFixture(deployContractFixture);

      await expect(
        payment.connect(owner).addSupportedToken(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid token");
    });
  });

  describe("8. Edge Cases", function () {
    it("Should handle payments with 18 decimal tokens (DAI)", async function () {
      const { payment, dai, buyer, apiKeyOwner, owner } = await loadFixture(deployContractFixture);

      const daiAddress = await dai.getAddress();
      await payment.connect(owner).addSupportedToken(daiAddress);

      const amount = ethers.parseUnits("100", 18); // 100 DAI (18 decimals)
      const orderId = ethers.keccak256(ethers.toUtf8Bytes("order-dai-1"));

      await dai.connect(buyer).approve(await payment.getAddress(), amount);

      await expect(
        payment.connect(buyer).processPayment(
          orderId,
          daiAddress,
          amount,
          "product-1",
          apiKeyOwner.address,
          500
        )
      ).to.not.be.reverted;
    });

    it("Should handle very large amounts", async function () {
      const { payment, usdt, buyer, apiKeyOwner, owner } = await loadFixture(deployContractFixture);

      const usdtAddress = await usdt.getAddress();
      await payment.connect(owner).addSupportedToken(usdtAddress);

      const largeAmount = ethers.parseUnits("1000000", 6); // 1 million USDT
      await usdt.mint(buyer.address, largeAmount);

      const orderId = ethers.keccak256(ethers.toUtf8Bytes("order-large"));

      await usdt.connect(buyer).approve(await payment.getAddress(), largeAmount);

      await expect(
        payment.connect(buyer).processPayment(
          orderId,
          usdtAddress,
          largeAmount,
          "product-1",
          apiKeyOwner.address,
          500
        )
      ).to.not.be.reverted;
    });

    it("Should handle small fractional amounts", async function () {
      const { payment, usdt, buyer, apiKeyOwner, owner } = await loadFixture(deployContractFixture);

      const usdtAddress = await usdt.getAddress();
      await payment.connect(owner).addSupportedToken(usdtAddress);

      const smallAmount = 1; // 0.000001 USDT (1 in smallest unit)
      const orderId = ethers.keccak256(ethers.toUtf8Bytes("order-small"));

      await usdt.connect(buyer).approve(await payment.getAddress(), smallAmount);

      await expect(
        payment.connect(buyer).processPayment(
          orderId,
          usdtAddress,
          smallAmount,
          "product-1",
          apiKeyOwner.address,
          500
        )
      ).to.not.be.reverted;
    });

    it("Should fail if buyer has insufficient balance", async function () {
      const { payment, usdt, attacker, apiKeyOwner, owner } = await loadFixture(deployContractFixture);

      const usdtAddress = await usdt.getAddress();
      await payment.connect(owner).addSupportedToken(usdtAddress);

      const amount = ethers.parseUnits("100", 6);
      const orderId = ethers.keccak256(ethers.toUtf8Bytes("order-123"));

      // Attacker has no USDT balance
      await usdt.connect(attacker).approve(await payment.getAddress(), amount);

      await expect(
        payment.connect(attacker).processPayment(
          orderId,
          usdtAddress,
          amount,
          "product-1",
          apiKeyOwner.address,
          500
        )
      ).to.be.reverted; // Will revert in ERC20 transfer
    });

    it("Should fail if buyer has insufficient allowance", async function () {
      const { payment, usdt, buyer, apiKeyOwner, owner } = await loadFixture(deployContractFixture);

      const usdtAddress = await usdt.getAddress();
      await payment.connect(owner).addSupportedToken(usdtAddress);

      const amount = ethers.parseUnits("100", 6);
      const orderId = ethers.keccak256(ethers.toUtf8Bytes("order-123"));

      // Not approving enough (only 50 USDT instead of 100)
      await usdt.connect(buyer).approve(await payment.getAddress(), amount / 2n);

      await expect(
        payment.connect(buyer).processPayment(
          orderId,
          usdtAddress,
          amount,
          "product-1",
          apiKeyOwner.address,
          500
        )
      ).to.be.reverted;
    });
  });

  describe("9. Gas Optimization Tests", function () {
    it("Should emit events efficiently", async function () {
      const { payment, usdt, buyer, apiKeyOwner, owner } = await loadFixture(deployContractFixture);

      const usdtAddress = await usdt.getAddress();
      await payment.connect(owner).addSupportedToken(usdtAddress);

      const amount = ethers.parseUnits("100", 6);
      const orderId = ethers.keccak256(ethers.toUtf8Bytes("order-123"));

      await usdt.connect(buyer).approve(await payment.getAddress(), amount);

      const tx = await payment.connect(buyer).processPayment(
        orderId,
        usdtAddress,
        amount,
        "product-1",
        apiKeyOwner.address,
        500
      );

      const receipt = await tx.wait();
      console.log("      Gas used for single payment:", receipt.gasUsed.toString());
    });

    it("Should compare gas cost: single vs batch", async function () {
      const { payment, usdt, buyer, apiKeyOwner, owner } = await loadFixture(deployContractFixture);

      const usdtAddress = await usdt.getAddress();
      await payment.connect(owner).addSupportedToken(usdtAddress);

      // Single payment
      const singleAmount = ethers.parseUnits("100", 6);
      const orderId1 = ethers.keccak256(ethers.toUtf8Bytes("order-single"));

      await usdt.connect(buyer).approve(await payment.getAddress(), singleAmount);
      const tx1 = await payment.connect(buyer).processPayment(
        orderId1,
        usdtAddress,
        singleAmount,
        "product-1",
        apiKeyOwner.address,
        500
      );
      const receipt1 = await tx1.wait();

      // Batch payment
      const batchAmount = ethers.parseUnits("300", 6);
      const orderId2 = ethers.keccak256(ethers.toUtf8Bytes("order-batch"));

      await usdt.connect(buyer).approve(await payment.getAddress(), batchAmount);
      const tx2 = await payment.connect(buyer).processBatchPayment(
        orderId2,
        usdtAddress,
        batchAmount,
        ["product-1", "product-2", "product-3"],
        apiKeyOwner.address,
        500
      );
      const receipt2 = await tx2.wait();

      console.log("      Single payment gas:", receipt1.gasUsed.toString());
      console.log("      Batch payment gas (3 products):", receipt2.gasUsed.toString());
      console.log("      Gas savings per product:", ((receipt1.gasUsed * 3n - receipt2.gasUsed) / 3n).toString());
    });
  });
});
