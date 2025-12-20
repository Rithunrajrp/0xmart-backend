import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { OxmartPayment } from "../target/types/oxmart_payment";
import { expect } from "chai";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";

describe("oxmart-payment", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.OxmartPayment as Program<OxmartPayment>;

  // Test accounts
  let authority: Keypair;
  let hotWallet: Keypair;
  let buyer: Keypair;
  let apiKeyOwner: Keypair;

  // Token mint and accounts
  let tokenMint: PublicKey;
  let buyerTokenAccount: PublicKey;
  let hotWalletTokenAccount: PublicKey;

  // PDAs
  let configPDA: PublicKey;
  let configBump: number;

  before(async () => {
    // Initialize test accounts
    authority = Keypair.generate();
    hotWallet = Keypair.generate();
    buyer = Keypair.generate();
    apiKeyOwner = Keypair.generate();

    // Airdrop SOL for test accounts
    await provider.connection.requestAirdrop(
      authority.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.requestAirdrop(
      buyer.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.requestAirdrop(
      hotWallet.publicKey,
      1 * anchor.web3.LAMPORTS_PER_SOL
    );

    // Wait for airdrops to complete
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Find config PDA
    [configPDA, configBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      program.programId
    );

    // Create token mint (USDC-like with 6 decimals)
    tokenMint = await createMint(
      provider.connection,
      authority,
      authority.publicKey,
      authority.publicKey,
      6 // 6 decimals like USDC
    );

    // Create token accounts
    const buyerAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      authority,
      tokenMint,
      buyer.publicKey
    );
    buyerTokenAccount = buyerAccount.address;

    const hotWalletAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      authority,
      tokenMint,
      hotWallet.publicKey
    );
    hotWalletTokenAccount = hotWalletAccount.address;

    // Mint tokens to buyer
    await mintTo(
      provider.connection,
      authority,
      tokenMint,
      buyerTokenAccount,
      authority,
      1_000_000_000_000 // 1M USDC (6 decimals)
    );
  });

  describe("Initialization", () => {
    it("Should initialize the payment program", async () => {
      const platformFeeBps = 0; // 0% platform fee

      const tx = await program.methods
        .initialize(hotWallet.publicKey, platformFeeBps)
        .accounts({
          config: configPDA,
          authority: authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      console.log("Initialize transaction:", tx);

      // Fetch and verify config
      const config = await program.account.config.fetch(configPDA);
      expect(config.authority.toString()).to.equal(
        authority.publicKey.toString()
      );
      expect(config.hotWallet.toString()).to.equal(
        hotWallet.publicKey.toString()
      );
      expect(config.platformFeeBps).to.equal(platformFeeBps);
      expect(config.paused).to.be.false;
    });

    it("Should reject platform fee > 10%", async () => {
      const newAuthority = Keypair.generate();
      await provider.connection.requestAirdrop(
        newAuthority.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      );
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const [newConfigPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("config2")],
        program.programId
      );

      try {
        await program.methods
          .initialize(hotWallet.publicKey, 1001) // 10.01%
          .accounts({
            config: newConfigPDA,
            authority: newAuthority.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([newAuthority])
          .rpc();

        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error.message).to.include("FeeTooHigh");
      }
    });
  });

  describe("Single Payment Processing", () => {
    it("Should process payment successfully", async () => {
      const orderId = Keypair.generate().publicKey.toBytes();
      const amount = new anchor.BN(100_000_000); // 100 USDC
      const productId = "product-123";
      const commissionBps = 500; // 5%

      const [orderRecordPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("order"), orderId],
        program.programId
      );

      const initialBalance = (
        await provider.connection.getTokenAccountBalance(hotWalletTokenAccount)
      ).value.amount;

      const tx = await program.methods
        .processPayment(
          Array.from(orderId),
          amount,
          productId,
          apiKeyOwner.publicKey,
          commissionBps
        )
        .accounts({
          config: configPDA,
          orderRecord: orderRecordPDA,
          buyer: buyer.publicKey,
          buyerTokenAccount: buyerTokenAccount,
          hotWalletTokenAccount: hotWalletTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([buyer])
        .rpc();

      console.log("Payment transaction:", tx);

      // Verify order record
      const orderRecord = await program.account.orderRecord.fetch(
        orderRecordPDA
      );
      expect(orderRecord.processed).to.be.true;
      expect(orderRecord.buyer.toString()).to.equal(buyer.publicKey.toString());
      expect(orderRecord.amount.toString()).to.equal(amount.toString());
      expect(orderRecord.productId).to.equal(productId);
      expect(orderRecord.commission.toNumber()).to.equal(5_000_000); // 5% of 100

      // Verify token transfer
      const finalBalance = (
        await provider.connection.getTokenAccountBalance(hotWalletTokenAccount)
      ).value.amount;
      expect(
        BigInt(finalBalance) - BigInt(initialBalance)
      ).to.equal(BigInt(amount.toString()));
    });

    it("Should prevent double-spending", async () => {
      const orderId = Keypair.generate().publicKey.toBytes();
      const amount = new anchor.BN(50_000_000); // 50 USDC

      const [orderRecordPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("order"), orderId],
        program.programId
      );

      // First payment
      await program.methods
        .processPayment(
          Array.from(orderId),
          amount,
          "product-456",
          apiKeyOwner.publicKey,
          500
        )
        .accounts({
          config: configPDA,
          orderRecord: orderRecordPDA,
          buyer: buyer.publicKey,
          buyerTokenAccount: buyerTokenAccount,
          hotWalletTokenAccount: hotWalletTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([buyer])
        .rpc();

      // Try second payment with same order ID
      try {
        await program.methods
          .processPayment(
            Array.from(orderId),
            amount,
            "product-456",
            apiKeyOwner.publicKey,
            500
          )
          .accounts({
            config: configPDA,
            orderRecord: orderRecordPDA,
            buyer: buyer.publicKey,
            buyerTokenAccount: buyerTokenAccount,
            hotWalletTokenAccount: hotWalletTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([buyer])
          .rpc();

        expect.fail("Should have thrown error");
      } catch (error) {
        // Should fail because account already exists
        expect(error.message).to.include("already in use");
      }
    });

    it("Should reject zero amount", async () => {
      const orderId = Keypair.generate().publicKey.toBytes();
      const [orderRecordPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("order"), orderId],
        program.programId
      );

      try {
        await program.methods
          .processPayment(
            Array.from(orderId),
            new anchor.BN(0),
            "product-789",
            apiKeyOwner.publicKey,
            500
          )
          .accounts({
            config: configPDA,
            orderRecord: orderRecordPDA,
            buyer: buyer.publicKey,
            buyerTokenAccount: buyerTokenAccount,
            hotWalletTokenAccount: hotWalletTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([buyer])
          .rpc();

        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error.message).to.include("InvalidAmount");
      }
    });

    it("Should reject invalid commission (>100%)", async () => {
      const orderId = Keypair.generate().publicKey.toBytes();
      const [orderRecordPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("order"), orderId],
        program.programId
      );

      try {
        await program.methods
          .processPayment(
            Array.from(orderId),
            new anchor.BN(100_000_000),
            "product-999",
            apiKeyOwner.publicKey,
            10001 // 100.01%
          )
          .accounts({
            config: configPDA,
            orderRecord: orderRecordPDA,
            buyer: buyer.publicKey,
            buyerTokenAccount: buyerTokenAccount,
            hotWalletTokenAccount: hotWalletTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([buyer])
          .rpc();

        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error.message).to.include("InvalidCommission");
      }
    });
  });

  describe("Batch Payment Processing", () => {
    it("Should process batch payment successfully", async () => {
      const orderId = Keypair.generate().publicKey.toBytes();
      const totalAmount = new anchor.BN(300_000_000); // 300 USDC
      const productIds = ["product-1", "product-2", "product-3"];
      const commissionBps = 500;

      const [orderRecordPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("order"), orderId],
        program.programId
      );

      const tx = await program.methods
        .processBatchPayment(
          Array.from(orderId),
          totalAmount,
          productIds,
          apiKeyOwner.publicKey,
          commissionBps
        )
        .accounts({
          config: configPDA,
          orderRecord: orderRecordPDA,
          buyer: buyer.publicKey,
          buyerTokenAccount: buyerTokenAccount,
          hotWalletTokenAccount: hotWalletTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([buyer])
        .rpc();

      console.log("Batch payment transaction:", tx);

      const orderRecord = await program.account.orderRecord.fetch(
        orderRecordPDA
      );
      expect(orderRecord.processed).to.be.true;
      expect(orderRecord.amount.toString()).to.equal(totalAmount.toString());
      expect(orderRecord.commission.toNumber()).to.equal(15_000_000); // 5% of 300
    });

    it("Should reject empty product list", async () => {
      const orderId = Keypair.generate().publicKey.toBytes();
      const [orderRecordPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("order"), orderId],
        program.programId
      );

      try {
        await program.methods
          .processBatchPayment(
            Array.from(orderId),
            new anchor.BN(100_000_000),
            [], // Empty products
            apiKeyOwner.publicKey,
            500
          )
          .accounts({
            config: configPDA,
            orderRecord: orderRecordPDA,
            buyer: buyer.publicKey,
            buyerTokenAccount: buyerTokenAccount,
            hotWalletTokenAccount: hotWalletTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([buyer])
          .rpc();

        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error.message).to.include("NoProducts");
      }
    });
  });

  describe("Admin Functions", () => {
    it("Should update hot wallet", async () => {
      const newHotWallet = Keypair.generate();

      await program.methods
        .updateHotWallet(newHotWallet.publicKey)
        .accounts({
          config: configPDA,
          authority: authority.publicKey,
        })
        .signers([authority])
        .rpc();

      const config = await program.account.config.fetch(configPDA);
      expect(config.hotWallet.toString()).to.equal(
        newHotWallet.publicKey.toString()
      );

      // Restore original hot wallet
      await program.methods
        .updateHotWallet(hotWallet.publicKey)
        .accounts({
          config: configPDA,
          authority: authority.publicKey,
        })
        .signers([authority])
        .rpc();
    });

    it("Should update platform fee", async () => {
      await program.methods
        .updatePlatformFee(200) // 2%
        .accounts({
          config: configPDA,
          authority: authority.publicKey,
        })
        .signers([authority])
        .rpc();

      const config = await program.account.config.fetch(configPDA);
      expect(config.platformFeeBps).to.equal(200);

      // Reset to 0%
      await program.methods
        .updatePlatformFee(0)
        .accounts({
          config: configPDA,
          authority: authority.publicKey,
        })
        .signers([authority])
        .rpc();
    });

    it("Should pause and unpause program", async () => {
      // Pause
      await program.methods
        .pause()
        .accounts({
          config: configPDA,
          authority: authority.publicKey,
        })
        .signers([authority])
        .rpc();

      let config = await program.account.config.fetch(configPDA);
      expect(config.paused).to.be.true;

      // Try payment while paused (should fail)
      const orderId = Keypair.generate().publicKey.toBytes();
      const [orderRecordPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("order"), orderId],
        program.programId
      );

      try {
        await program.methods
          .processPayment(
            Array.from(orderId),
            new anchor.BN(50_000_000),
            "product-test",
            apiKeyOwner.publicKey,
            500
          )
          .accounts({
            config: configPDA,
            orderRecord: orderRecordPDA,
            buyer: buyer.publicKey,
            buyerTokenAccount: buyerTokenAccount,
            hotWalletTokenAccount: hotWalletTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([buyer])
          .rpc();

        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error.message).to.include("ProgramPaused");
      }

      // Unpause
      await program.methods
        .unpause()
        .accounts({
          config: configPDA,
          authority: authority.publicKey,
        })
        .signers([authority])
        .rpc();

      config = await program.account.config.fetch(configPDA);
      expect(config.paused).to.be.false;
    });

    it("Should reject unauthorized admin operations", async () => {
      const attacker = Keypair.generate();
      await provider.connection.requestAirdrop(
        attacker.publicKey,
        1 * anchor.web3.LAMPORTS_PER_SOL
      );
      await new Promise((resolve) => setTimeout(resolve, 2000));

      try {
        await program.methods
          .pause()
          .accounts({
            config: configPDA,
            authority: attacker.publicKey,
          })
          .signers([attacker])
          .rpc();

        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error.message).to.include("Unauthorized");
      }
    });
  });
});
