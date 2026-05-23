const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Security Attack Vectors - Professional Audit", function () {
  // Fixture to deploy contracts
  async function deployContractFixture() {
    const [owner, hotWallet, buyer, apiKeyOwner, attacker] = await ethers.getSigners();

    // Deploy mock ERC20 tokens
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdt = await MockERC20.deploy("Tether USD", "USDT", 6);
    await usdt.waitForDeployment();

    // Deploy OxMartPayment contract
    const OxMartPayment = await ethers.getContractFactory("OxMartPayment");
    const payment = await OxMartPayment.deploy(hotWallet.address);
    await payment.waitForDeployment();

    // Deploy PaymentProcessor contract
    const PaymentProcessor = await ethers.getContractFactory("PaymentProcessor");
    const processor = await PaymentProcessor.deploy(hotWallet.address);
    await processor.waitForDeployment();

    // Setup tokens
    const mintAmount = ethers.parseUnits("10000", 6);
    await usdt.mint(buyer.address, mintAmount);
    await usdt.mint(attacker.address, mintAmount);

    // Add USDT as supported token
    await payment.connect(owner).addSupportedToken(await usdt.getAddress());
    await processor.connect(owner).addSupportedToken(await usdt.getAddress());

    return {
      payment,
      processor,
      usdt,
      owner,
      hotWallet,
      buyer,
      apiKeyOwner,
      attacker
    };
  }

  describe("CRITICAL-NEW-01: Order Marked Before Transfer Attack", function () {
    it("Should NOT mark order as processed if transfer fails", async function () {
      const { payment, usdt, attacker, apiKeyOwner, owner } = await loadFixture(deployContractFixture);

      const amount = ethers.parseUnits("100", 6);
      const orderId = ethers.keccak256(ethers.toUtf8Bytes("order-fail-test"));

      // Attacker approves but has insufficient balance
      // Burn all attacker's tokens
      await usdt.connect(attacker).burn(await usdt.balanceOf(attacker.address));

      // Approve payment
      await usdt.connect(attacker).approve(await payment.getAddress(), amount);

      // Attempt payment - should fail
      await expect(
        payment.connect(attacker).processPayment(
          orderId,
          await usdt.getAddress(),
          amount,
          "product-1",
          apiKeyOwner.address,
          500
        )
      ).to.be.reverted;

      // CRITICAL TEST: Order should NOT be marked as processed
      expect(await payment.processedOrders(orderId)).to.be.false;

      // User should be able to retry with sufficient balance
      await usdt.mint(attacker.address, amount);
      await usdt.connect(attacker).approve(await payment.getAddress(), amount);

      await payment.connect(attacker).processPayment(
        orderId,
        await usdt.getAddress(),
        amount,
        "product-1",
        apiKeyOwner.address,
        500
      );

      // Now it should be marked
      expect(await payment.processedOrders(orderId)).to.be.true;
    });

    it("Should mark order as processed ONLY after successful transfer", async function () {
      const { payment, usdt, buyer, apiKeyOwner } = await loadFixture(deployContractFixture);

      const amount = ethers.parseUnits("100", 6);
      const orderId = ethers.keccak256(ethers.toUtf8Bytes("order-success"));

      await usdt.connect(buyer).approve(await payment.getAddress(), amount);

      // Before payment
      expect(await payment.processedOrders(orderId)).to.be.false;

      // Process payment
      await payment.connect(buyer).processPayment(
        orderId,
        await usdt.getAddress(),
        amount,
        "product-1",
        apiKeyOwner.address,
        500
      );

      // After successful payment
      expect(await payment.processedOrders(orderId)).to.be.true;
    });
  });

  describe("CRITICAL-NEW-02: Allowance Verification Attack", function () {
    it("Should reject payment if insufficient allowance", async function () {
      const { payment, usdt, buyer, apiKeyOwner } = await loadFixture(deployContractFixture);

      const amount = ethers.parseUnits("100", 6);
      const orderId = ethers.keccak256(ethers.toUtf8Bytes("order-allowance"));

      // Approve only half
      await usdt.connect(buyer).approve(await payment.getAddress(), amount / 2n);

      await expect(
        payment.connect(buyer).processPayment(
          orderId,
          await usdt.getAddress(),
          amount,
          "product-1",
          apiKeyOwner.address,
          500
        )
      ).to.be.revertedWith("Insufficient allowance");

      // Order should not be marked as processed
      expect(await payment.processedOrders(orderId)).to.be.false;
    });

    it("Should reject payment if zero allowance", async function () {
      const { payment, usdt, buyer, apiKeyOwner } = await loadFixture(deployContractFixture);

      const amount = ethers.parseUnits("100", 6);
      const orderId = ethers.keccak256(ethers.toUtf8Bytes("order-zero-allowance"));

      // No approval

      await expect(
        payment.connect(buyer).processPayment(
          orderId,
          await usdt.getAddress(),
          amount,
          "product-1",
          apiKeyOwner.address,
          500
        )
      ).to.be.revertedWith("Insufficient allowance");
    });

    it("Should prevent front-running by checking allowance at execution time", async function () {
      const { payment, usdt, buyer, apiKeyOwner } = await loadFixture(deployContractFixture);

      const amount = ethers.parseUnits("100", 6);
      const orderId = ethers.keccak256(ethers.toUtf8Bytes("order-frontrun"));

      // Buyer approves
      await usdt.connect(buyer).approve(await payment.getAddress(), amount);

      // Simulate front-running: reduce approval before payment executes
      await usdt.connect(buyer).approve(await payment.getAddress(), 0);

      // Payment should fail due to insufficient allowance
      await expect(
        payment.connect(buyer).processPayment(
          orderId,
          await usdt.getAddress(),
          amount,
          "product-1",
          apiKeyOwner.address,
          500
        )
      ).to.be.revertedWith("Insufficient allowance");
    });
  });

  describe("CRITICAL-NEW-03: Duplicate Orders in Batch Attack", function () {
    it("Should reject batch with duplicate order IDs", async function () {
      const { processor, usdt, buyer } = await loadFixture(deployContractFixture);

      const orderId1 = ethers.keccak256(ethers.toUtf8Bytes("order-1"));
      const orderId2 = orderId1; // DUPLICATE!
      const orderId3 = ethers.keccak256(ethers.toUtf8Bytes("order-3"));

      const orderIds = [orderId1, orderId2, orderId3];
      const productIds = ["prod-1", "prod-2", "prod-3"];
      const amounts = [
        ethers.parseUnits("100", 6),
        ethers.parseUnits("200", 6),
        ethers.parseUnits("150", 6)
      ];

      const totalAmount = amounts.reduce((a, b) => a + b, 0n);
      await usdt.connect(buyer).approve(await processor.getAddress(), totalAmount);

      // Should revert due to duplicate
      await expect(
        processor.connect(buyer).batchPayForProducts(
          orderIds,
          productIds,
          await usdt.getAddress(),
          amounts
        )
      ).to.be.revertedWith("Duplicate order in batch");
    });

    it("Should accept batch with all unique order IDs", async function () {
      const { processor, usdt, buyer } = await loadFixture(deployContractFixture);

      const orderId1 = ethers.keccak256(ethers.toUtf8Bytes("order-1"));
      const orderId2 = ethers.keccak256(ethers.toUtf8Bytes("order-2"));
      const orderId3 = ethers.keccak256(ethers.toUtf8Bytes("order-3"));

      const orderIds = [orderId1, orderId2, orderId3];
      const productIds = ["prod-1", "prod-2", "prod-3"];
      const amounts = [
        ethers.parseUnits("100", 6),
        ethers.parseUnits("200", 6),
        ethers.parseUnits("150", 6)
      ];

      const totalAmount = amounts.reduce((a, b) => a + b, 0n);
      await usdt.connect(buyer).approve(await processor.getAddress(), totalAmount);

      await expect(
        processor.connect(buyer).batchPayForProducts(
          orderIds,
          productIds,
          await usdt.getAddress(),
          amounts
        )
      ).to.not.be.reverted;

      // All orders should be marked
      expect(await processor.processedOrders(orderId1)).to.be.true;
      expect(await processor.processedOrders(orderId2)).to.be.true;
      expect(await processor.processedOrders(orderId3)).to.be.true;
    });

    it("Should prevent triple-spend attack with all same order IDs", async function () {
      const { processor, usdt, buyer } = await loadFixture(deployContractFixture);

      const orderId = ethers.keccak256(ethers.toUtf8Bytes("same-order"));
      const orderIds = [orderId, orderId, orderId]; // All same!
      const productIds = ["prod-1", "prod-2", "prod-3"];
      const amounts = [
        ethers.parseUnits("100", 6),
        ethers.parseUnits("100", 6),
        ethers.parseUnits("100", 6)
      ];

      const totalAmount = amounts.reduce((a, b) => a + b, 0n);
      await usdt.connect(buyer).approve(await processor.getAddress(), totalAmount);

      await expect(
        processor.connect(buyer).batchPayForProducts(
          orderIds,
          productIds,
          await usdt.getAddress(),
          amounts
        )
      ).to.be.revertedWith("Duplicate order in batch");
    });
  });

  describe("CRITICAL-NEW-04: Fake Token Attack", function () {
    it("Should reject payments with unsupported tokens", async function () {
      const { processor, buyer, apiKeyOwner } = await loadFixture(deployContractFixture);

      // Deploy fake token
      const FakeToken = await ethers.getContractFactory("MockERC20");
      const fakeUSDT = await FakeToken.deploy("Fake USDT", "FUSDT", 6);
      await fakeUSDT.waitForDeployment();

      // Attacker mints unlimited fake tokens
      await fakeUSDT.mint(buyer.address, ethers.parseUnits("1000000", 6));

      const amount = ethers.parseUnits("100", 6);
      const orderId = ethers.keccak256(ethers.toUtf8Bytes("fake-token-order"));

      await fakeUSDT.connect(buyer).approve(await processor.getAddress(), amount);

      // Should reject because token not supported
      await expect(
        processor.connect(buyer).payForProduct(
          orderId,
          "product-1",
          await fakeUSDT.getAddress(),
          amount
        )
      ).to.be.revertedWith("Token not supported");
    });

    it("Should only accept whitelisted tokens", async function () {
      const { processor, usdt, buyer, owner } = await loadFixture(deployContractFixture);

      const amount = ethers.parseUnits("100", 6);
      const orderId = ethers.keccak256(ethers.toUtf8Bytes("whitelist-test"));

      await usdt.connect(buyer).approve(await processor.getAddress(), amount);

      // Remove USDT from whitelist
      await processor.connect(owner).removeSupportedToken(await usdt.getAddress());

      // Should fail
      await expect(
        processor.connect(buyer).payForProduct(
          orderId,
          "product-1",
          await usdt.getAddress(),
          amount
        )
      ).to.be.revertedWith("Token not supported");

      // Add back
      await processor.connect(owner).addSupportedToken(await usdt.getAddress());

      // Should succeed
      await expect(
        processor.connect(buyer).payForProduct(
          orderId,
          "product-1",
          await usdt.getAddress(),
          amount
        )
      ).to.not.be.reverted;
    });
  });

  describe("MEDIUM: Batch Size DoS Attack", function () {
    it("Should reject batch with more than MAX_BATCH_SIZE items", async function () {
      const { processor, usdt, buyer } = await loadFixture(deployContractFixture);

      // Create 51 items (MAX is 50)
      const orderIds = [];
      const productIds = [];
      const amounts = [];

      for (let i = 0; i < 51; i++) {
        orderIds.push(ethers.keccak256(ethers.toUtf8Bytes(`order-${i}`)));
        productIds.push(`product-${i}`);
        amounts.push(ethers.parseUnits("10", 6));
      }

      const totalAmount = ethers.parseUnits("510", 6);
      await usdt.connect(buyer).approve(await processor.getAddress(), totalAmount);

      await expect(
        processor.connect(buyer).batchPayForProducts(
          orderIds,
          productIds,
          await usdt.getAddress(),
          amounts
        )
      ).to.be.revertedWith("Invalid batch size");
    });

    it("Should accept batch with exactly MAX_BATCH_SIZE items", async function () {
      const { processor, usdt, buyer } = await loadFixture(deployContractFixture);

      // Create exactly 50 items
      const orderIds = [];
      const productIds = [];
      const amounts = [];

      for (let i = 0; i < 50; i++) {
        orderIds.push(ethers.keccak256(ethers.toUtf8Bytes(`order-max-${i}`)));
        productIds.push(`product-${i}`);
        amounts.push(ethers.parseUnits("10", 6));
      }

      const totalAmount = ethers.parseUnits("500", 6);
      await usdt.connect(buyer).approve(await processor.getAddress(), totalAmount);

      await expect(
        processor.connect(buyer).batchPayForProducts(
          orderIds,
          productIds,
          await usdt.getAddress(),
          amounts
        )
      ).to.not.be.reverted;
    });
  });

  describe("HIGH: Emergency Withdrawal Timelock", function () {
    it("Should enforce 48-hour timelock on emergency withdrawal", async function () {
      const { payment, usdt, owner } = await loadFixture(deployContractFixture);

      // Send some USDT to contract
      const amount = ethers.parseUnits("100", 6);
      await usdt.mint(await payment.getAddress(), amount);

      // Initiate withdrawal
      await payment.connect(owner).initiateEmergencyWithdrawal(await usdt.getAddress());

      // Should fail immediately
      await expect(
        payment.connect(owner).executeEmergencyWithdrawal()
      ).to.be.revertedWith("Timelock active");

      // Fast forward 47 hours (still too early)
      await time.increase(47 * 3600);

      await expect(
        payment.connect(owner).executeEmergencyWithdrawal()
      ).to.be.revertedWith("Timelock active");

      // Fast forward past 48 hours
      await time.increase(2 * 3600);

      // Should succeed now
      await expect(
        payment.connect(owner).executeEmergencyWithdrawal()
      ).to.not.be.reverted;
    });

    it("Should allow cancellation of pending withdrawal", async function () {
      const { payment, usdt, owner } = await loadFixture(deployContractFixture);

      const amount = ethers.parseUnits("100", 6);
      await usdt.mint(await payment.getAddress(), amount);

      await payment.connect(owner).initiateEmergencyWithdrawal(await usdt.getAddress());

      // Cancel withdrawal
      await expect(
        payment.connect(owner).cancelEmergencyWithdrawal()
      ).to.emit(payment, "EmergencyWithdrawalCancelled");

      // Fast forward past 48 hours
      await time.increase(49 * 3600);

      // Should fail because it was cancelled
      await expect(
        payment.connect(owner).executeEmergencyWithdrawal()
      ).to.be.revertedWith("No pending withdrawal");
    });
  });

  describe("HIGH: Maximum Pause Duration", function () {
    it("Should auto-unpause after 30 days", async function () {
      const { payment, usdt, buyer, apiKeyOwner, owner } = await loadFixture(deployContractFixture);

      const amount = ethers.parseUnits("100", 6);
      const orderId = ethers.keccak256(ethers.toUtf8Bytes("auto-unpause"));

      await usdt.connect(buyer).approve(await payment.getAddress(), amount);

      // Pause contract
      await payment.connect(owner).pause();

      // Payment should fail
      await expect(
        payment.connect(buyer).processPayment(
          orderId,
          await usdt.getAddress(),
          amount,
          "product-1",
          apiKeyOwner.address,
          500
        )
      ).to.be.revertedWith("Contract paused");

      // Fast forward 29 days (still paused)
      await time.increase(29 * 24 * 3600);

      await expect(
        payment.connect(buyer).processPayment(
          orderId,
          await usdt.getAddress(),
          amount,
          "product-1",
          apiKeyOwner.address,
          500
        )
      ).to.be.revertedWith("Contract paused");

      // Fast forward past 30 days
      await time.increase(2 * 24 * 3600);

      // Should work now (auto-unpaused)
      await expect(
        payment.connect(buyer).processPayment(
          orderId,
          await usdt.getAddress(),
          amount,
          "product-1",
          apiKeyOwner.address,
          500
        )
      ).to.not.be.reverted;
    });
  });

  describe("Edge Case: Product ID Validation", function () {
    it("Should reject empty product ID", async function () {
      const { payment, usdt, buyer, apiKeyOwner } = await loadFixture(deployContractFixture);

      const amount = ethers.parseUnits("100", 6);
      const orderId = ethers.keccak256(ethers.toUtf8Bytes("empty-product"));

      await usdt.connect(buyer).approve(await payment.getAddress(), amount);

      await expect(
        payment.connect(buyer).processPayment(
          orderId,
          await usdt.getAddress(),
          amount,
          "", // Empty product ID
          apiKeyOwner.address,
          500
        )
      ).to.be.revertedWith("Invalid product ID");
    });

    it("Should reject product ID longer than 100 characters", async function () {
      const { payment, usdt, buyer, apiKeyOwner } = await loadFixture(deployContractFixture);

      const amount = ethers.parseUnits("100", 6);
      const orderId = ethers.keccak256(ethers.toUtf8Bytes("long-product"));

      await usdt.connect(buyer).approve(await payment.getAddress(), amount);

      // 101 character product ID
      const longProductId = "a".repeat(101);

      await expect(
        payment.connect(buyer).processPayment(
          orderId,
          await usdt.getAddress(),
          amount,
          longProductId,
          apiKeyOwner.address,
          500
        )
      ).to.be.revertedWith("Invalid product ID");
    });

    it("Should accept product ID with exactly 100 characters", async function () {
      const { payment, usdt, buyer, apiKeyOwner } = await loadFixture(deployContractFixture);

      const amount = ethers.parseUnits("100", 6);
      const orderId = ethers.keccak256(ethers.toUtf8Bytes("max-product"));

      await usdt.connect(buyer).approve(await payment.getAddress(), amount);

      // Exactly 100 characters
      const maxProductId = "a".repeat(100);

      await expect(
        payment.connect(buyer).processPayment(
          orderId,
          await usdt.getAddress(),
          amount,
          maxProductId,
          apiKeyOwner.address,
          500
        )
      ).to.not.be.reverted;
    });
  });

  describe("Edge Case: Hot Wallet Update", function () {
    it("Should reject updating to same hot wallet", async function () {
      const { payment, hotWallet, owner } = await loadFixture(deployContractFixture);

      await expect(
        payment.connect(owner).updateHotWallet(hotWallet.address)
      ).to.be.revertedWith("Same as current");
    });

    it("Should allow updating to different hot wallet", async function () {
      const { payment, buyer, owner } = await loadFixture(deployContractFixture);

      await expect(
        payment.connect(owner).updateHotWallet(buyer.address)
      ).to.emit(payment, "HotWalletUpdated");

      expect(await payment.hotWallet()).to.equal(buyer.address);
    });
  });

  describe("Stress Test: Concurrent Payments", function () {
    it("Should handle multiple concurrent payments correctly", async function () {
      const { payment, usdt, buyer, apiKeyOwner } = await loadFixture(deployContractFixture);

      const amount = ethers.parseUnits("100", 6);

      // Create 10 different orders
      const orders = [];
      for (let i = 0; i < 10; i++) {
        orders.push({
          orderId: ethers.keccak256(ethers.toUtf8Bytes(`concurrent-order-${i}`)),
          productId: `product-${i}`
        });
      }

      // Approve total amount
      await usdt.connect(buyer).approve(await payment.getAddress(), amount * 10n);

      // Process all orders
      for (const order of orders) {
        await payment.connect(buyer).processPayment(
          order.orderId,
          await usdt.getAddress(),
          amount,
          order.productId,
          apiKeyOwner.address,
          500
        );
      }

      // Verify all orders are marked as processed
      for (const order of orders) {
        expect(await payment.processedOrders(order.orderId)).to.be.true;
      }
    });
  });
});
