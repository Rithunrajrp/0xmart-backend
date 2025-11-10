import { Injectable, Logger } from '@nestjs/common';
import { ethers } from 'ethers';
import * as bip39 from 'bip39';
import { HDKey } from '@scure/bip32';

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
  ): Promise<{ address: string; privateKey: string }> {
    try {
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
        `Generated address for user ${userId}: ${wallet.address}`,
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

  // Validate address format
  isValidAddress(address: string, network: string): boolean {
    try {
      // For EVM chains (Ethereum, Polygon, BSC, Arbitrum, Optimism)
      console.log(`Validating address for network ${network}: ${address}`);
      return ethers.utils.isAddress(address);
    } catch {
      return false;
    }
  }
}
