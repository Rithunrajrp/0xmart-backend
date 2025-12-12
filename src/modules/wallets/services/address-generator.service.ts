import { Injectable, Logger } from '@nestjs/common';
import { ethers } from 'ethers';
import * as bip39 from 'bip39';
import { HDKey } from '@scure/bip32';
import { Keypair } from '@solana/web3.js';
import { derivePath } from 'ed25519-hd-key';

@Injectable()
export class AddressGeneratorService {
  private readonly logger = new Logger(AddressGeneratorService.name);
  private masterSeed: string;

  constructor() {
    // In production, load this from secure storage (AWS Secrets Manager, HashiCorp Vault)
    this.masterSeed = process.env.MASTER_SEED || this.generateMasterSeed();
  }

  private generateMasterSeed(): string {
    // Generate a new mnemonic for master wallet
    const mnemonic = bip39.generateMnemonic();
    this.logger.warn('🔐 IMPORTANT: Store this master seed securely!');
    this.logger.warn(`Master Seed: ${mnemonic}`);
    return mnemonic;
  }

  async generateDepositAddress(
    userId: string,
    index: number,
    network?: string,
  ): Promise<{ address: string; privateKey: string }> {
    try {
      // Route to appropriate generation method based on network
      if (network === 'SOLANA') {
        return this.generateSolanaAddress(userId, index);
      }

      if (network === 'TON') {
        return this.generateTonAddress(userId, index);
      }

      if (network === 'SUI') {
        return this.generateSuiAddress(userId, index);
      }

      // Default: EVM address generation
      // Derive path: m/44'/60'/0'/0/{index}
      // This follows BIP44 standard for Ethereum
      const seed = await bip39.mnemonicToSeed(this.masterSeed);
      const hdkey = HDKey.fromMasterSeed(seed);

      // Use userId hash as part of derivation for uniqueness
      // const userHash = ethers.utils.id(userId).slice(2, 10); // Get 8 chars
      const derivationPath = `m/44'/60'/0'/0/${index}`;

      const derived = hdkey.derive(derivationPath);
      const privateKey = `0x${Buffer.from(derived.privateKey!).toString('hex')}`;

      const wallet = new ethers.Wallet(privateKey);
      this.logger.log(
        `Generated EVM address for user ${userId}: ${wallet.address}`,
      );
      return {
        address: wallet.address,
        privateKey: privateKey, // Store encrypted in production
      };
    } catch (error) {
      this.logger.error(`Failed to generate address: ${error}`);
      throw error;
    }
  }

  /**
   * Generate Solana address using BIP44 path m/44'/501'/0'/0'
   * Solana uses Ed25519 curve (different from Ethereum's secp256k1)
   */
  private async generateSolanaAddress(
    userId: string,
    index: number,
  ): Promise<{ address: string; privateKey: string }> {
    try {
      // Solana BIP44 path: m/44'/501'/0'/0' (501 is Solana's coin type)
      const seed = await bip39.mnemonicToSeed(this.masterSeed);
      const derivationPath = `m/44'/501'/${index}'/0'`;

      // Derive using Ed25519
      const derived = derivePath(derivationPath, seed.toString('hex'));
      const keypair = Keypair.fromSeed(derived.key);

      this.logger.log(
        `Generated Solana address for user ${userId}: ${keypair.publicKey.toString()}`,
      );

      return {
        address: keypair.publicKey.toString(),
        privateKey: Buffer.from(keypair.secretKey).toString('hex'),
      };
    } catch (error) {
      this.logger.error(`Failed to generate Solana address: ${error}`);
      throw error;
    }
  }

  /**
   * Generate TON address
   * TON uses a different derivation approach
   * Note: Full TON address generation requires ton-crypto library
   * This is a placeholder for basic implementation
   */
  private async generateTonAddress(
    userId: string,
    index: number,
  ): Promise<{ address: string; privateKey: string }> {
    try {
      // TON address generation requires:
      // 1. Generate Ed25519 keypair
      // 2. Create wallet contract (v3, v4, highload)
      // 3. Calculate address from contract code + public key

      const seed = await bip39.mnemonicToSeed(this.masterSeed);
      const derivationPath = `m/44'/607'/${index}'/0'`; // 607 is TON's coin type

      // Derive using Ed25519
      const derived = derivePath(derivationPath, seed.toString('hex'));

      // For now, return derived key
      // In production, use @ton/ton or @ton/crypto to generate proper wallet address
      const privateKey = Buffer.from(derived.key).toString('hex');

      // Placeholder address format (would need TON SDK for real address)
      // Real implementation would create wallet contract and calculate address
      const placeholderAddress = `EQ${Buffer.from(derived.key).toString('base64').substring(0, 46)}`;

      this.logger.warn(
        `⚠️ TON address generation is using placeholder. Install @ton/ton for production use.`,
      );
      this.logger.log(
        `Generated TON address for user ${userId}: ${placeholderAddress}`,
      );

      return {
        address: placeholderAddress,
        privateKey,
      };
    } catch (error) {
      this.logger.error(`Failed to generate TON address: ${error}`);
      throw error;
    }
  }

  /**
   * Generate SUI address using BIP44 path m/44'/784'/0'/0'
   * SUI uses Ed25519 curve (same as Solana)
   */
  private async generateSuiAddress(
    userId: string,
    index: number,
  ): Promise<{ address: string; privateKey: string }> {
    try {
      // SUI BIP44 path: m/44'/784'/0'/0' (784 is SUI's coin type)
      const seed = await bip39.mnemonicToSeed(this.masterSeed);
      const derivationPath = `m/44'/784'/${index}'/0'/0'`;

      // Derive using Ed25519
      const derived = derivePath(derivationPath, seed.toString('hex'));

      // SUI uses Blake2b hash of public key to derive address
      // Address format: 0x + first 32 bytes of hash
      const crypto = require('crypto');

      // Get public key from derived key (Ed25519: private key is 32 bytes, public key is also 32 bytes)
      // For Ed25519, the public key can be derived from the private key
      const { publicKey } = require('@solana/web3.js').Keypair.fromSeed(
        derived.key,
      );

      // SUI address = 0x + Blake2b(0x00 || public_key)[0:32]
      // The 0x00 prefix indicates Ed25519 signature scheme
      const addressBytes = Buffer.concat([
        Buffer.from([0x00]),
        publicKey.toBuffer(),
      ]);
      const hash = crypto
        .createHash('blake2b512')
        .update(addressBytes)
        .digest();

      // Take first 32 bytes and convert to hex
      const address = '0x' + hash.slice(0, 32).toString('hex');
      const privateKey = Buffer.from(derived.key).toString('hex');

      this.logger.log(`Generated SUI address for user ${userId}: ${address}`);

      return {
        address,
        privateKey,
      };
    } catch (error) {
      this.logger.error(`Failed to generate SUI address: ${error}`);
      throw error;
    }
  }

  // Validate address format
  isValidAddress(address: string, network: string): boolean {
    try {
      // For EVM chains (Ethereum, Polygon, BSC, Arbitrum, Optimism, Avalanche, Base)
      const evmNetworks = [
        'ETHEREUM',
        'POLYGON',
        'BSC',
        'ARBITRUM',
        'OPTIMISM',
        'AVALANCHE',
        'BASE',
      ];

      if (evmNetworks.includes(network.toUpperCase())) {
        return ethers.utils.isAddress(address);
      }

      // Solana addresses: base58 encoded, 32-44 characters
      if (network.toUpperCase() === 'SOLANA') {
        try {
          const publicKey = new (require('@solana/web3.js').PublicKey)(address);
          return require('@solana/web3.js').PublicKey.isOnCurve(
            publicKey.toBuffer(),
          );
        } catch {
          return false;
        }
      }

      // SUI addresses: 32-66 characters, base58 encoded, starts with 0x
      if (network.toUpperCase() === 'SUI') {
        const suiAddressRegex = /^0x[a-fA-F0-9]{1,64}$/;
        return (
          suiAddressRegex.test(address) &&
          address.length >= 3 &&
          address.length <= 66
        );
      }

      // TON addresses: base64url encoded, typically 48 characters
      if (network.toUpperCase() === 'TON') {
        // TON addresses can be in different formats (raw, user-friendly)
        // Basic validation: check if it's a valid base64url or hex
        const tonAddressRegex =
          /^[Ee][Qq][A-Za-z0-9_-]{46}$|^[A-Za-z0-9_-]{48}$/;
        return tonAddressRegex.test(address) && address.length >= 32;
      }

      // Default: try EVM validation
      return ethers.utils.isAddress(address);
    } catch {
      return false;
    }
  }
}
