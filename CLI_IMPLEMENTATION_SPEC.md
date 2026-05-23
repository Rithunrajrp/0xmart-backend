# 0xMart CLI - Implementation Specification

## Technical Stack

### CLI Framework
**Choice: [oclif](https://oclif.io/) by Salesforce**

**Why:**
- Enterprise-grade (used by Heroku, Shopify, Twilio)
- TypeScript-native
- Plugin architecture
- Auto-generated help docs
- Cross-platform (Windows, macOS, Linux)
- Built-in update mechanism
- Testing framework included

**Alternatives Considered:**
- Commander.js (too basic)
- Yargs (poor TypeScript support)
- Ink (React-based, overkill)

### Project Structure

```
@0xmart/cli/
├── src/
│   ├── commands/          # CLI commands
│   │   ├── login.ts
│   │   ├── pay.ts
│   │   ├── ads/
│   │   │   ├── list.ts
│   │   │   ├── recommend.ts
│   │   │   └── show.ts
│   │   ├── wallet/
│   │   │   ├── info.ts
│   │   │   ├── fund.ts
│   │   │   └── withdraw.ts
│   │   ├── config/
│   │   │   ├── set.ts
│   │   │   ├── get.ts
│   │   │   └── list.ts
│   │   └── history.ts
│   │
│   ├── lib/               # Core libraries
│   │   ├── api/          # API client
│   │   │   ├── client.ts
│   │   │   ├── auth.ts
│   │   │   ├── ads.ts
│   │   │   └── payments.ts
│   │   │
│   │   ├── wallet/       # Wallet abstraction
│   │   │   ├── custodial.ts
│   │   │   ├── non-custodial.ts
│   │   │   ├── hardware.ts
│   │   │   └── signer.ts
│   │   │
│   │   ├── blockchain/   # Blockchain interaction
│   │   │   ├── networks.ts
│   │   │   ├── gas.ts
│   │   │   ├── contracts.ts
│   │   │   └── rpc.ts
│   │   │
│   │   ├── security/     # Security utilities
│   │   │   ├── encryption.ts
│   │   │   ├── keystore.ts
│   │   │   ├── signature.ts
│   │   │   └── anti-phishing.ts
│   │   │
│   │   └── ui/           # Terminal UI
│   │       ├── spinner.ts
│   │       ├── prompts.ts
│   │       ├── tables.ts
│   │       └── colors.ts
│   │
│   ├── config/           # Configuration
│   │   ├── defaults.ts
│   │   ├── networks.ts
│   │   └── constants.ts
│   │
│   └── types/            # TypeScript types
│       ├── api.ts
│       ├── wallet.ts
│       └── config.ts
│
├── test/                 # Tests
├── bin/                  # Executable
├── package.json
└── README.md
```

---

## Core Modules

### 1. Authentication Module

**File:** `src/lib/api/auth.ts`

```typescript
import { CliUx } from '@oclif/core';
import * as keytar from 'keytar';
import axios from 'axios';

const SERVICE_NAME = '0xmart-cli';
const API_BASE_URL = process.env.OXMART_API_URL || 'https://api.0xmart.com/api/v1';

export class AuthManager {
  /**
   * Login with API key
   */
  static async login(apiKey?: string): Promise<void> {
    // Prompt for API key if not provided
    if (!apiKey) {
      apiKey = await CliUx.ux.prompt('Enter your API key', { type: 'mask' });
    }

    // Validate API key format
    if (!apiKey.startsWith('sk_') && !apiKey.startsWith('pk_')) {
      throw new Error('Invalid API key format. Must start with sk_ or pk_');
    }

    // Validate API key with backend
    try {
      const response = await axios.get(`${API_BASE_URL}/auth/validate-key`, {
        headers: { 'X-API-Key': apiKey }
      });

      const { user, scopes } = response.data;

      // Store API key in OS keychain
      await keytar.setPassword(SERVICE_NAME, user.email, apiKey);

      // Store user info in config
      await this.saveUserInfo({ email: user.email, scopes });

      CliUx.ux.log(`✅ Logged in as: ${user.email}`);
      CliUx.ux.log(`Scopes: ${scopes.join(', ')}`);
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Invalid API key');
      }
      throw new Error(`Login failed: ${error.message}`);
    }
  }

  /**
   * Get stored API key
   */
  static async getApiKey(): Promise<string | null> {
    const userInfo = await this.getUserInfo();
    if (!userInfo?.email) return null;

    return await keytar.getPassword(SERVICE_NAME, userInfo.email);
  }

  /**
   * Logout
   */
  static async logout(): Promise<void> {
    const userInfo = await this.getUserInfo();
    if (!userInfo?.email) {
      throw new Error('Not logged in');
    }

    await keytar.deletePassword(SERVICE_NAME, userInfo.email);
    await this.clearUserInfo();

    CliUx.ux.log('✅ Logged out successfully');
  }

  /**
   * Get current user info
   */
  static async whoami(): Promise<void> {
    const userInfo = await this.getUserInfo();
    if (!userInfo) {
      throw new Error('Not logged in. Run: 0xmart login');
    }

    const apiKey = await this.getApiKey();
    const maskedKey = apiKey ? `${apiKey.substring(0, 7)}...${apiKey.substring(apiKey.length - 4)}` : 'N/A';

    CliUx.ux.log(`Logged in as: ${userInfo.email}`);
    CliUx.ux.log(`API Key: ${maskedKey}`);
    CliUx.ux.log(`Scopes: ${userInfo.scopes?.join(', ') || 'N/A'}`);
  }

  /**
   * Check if user is authenticated
   */
  static async isAuthenticated(): Promise<boolean> {
    const apiKey = await this.getApiKey();
    return !!apiKey;
  }

  /**
   * Get user info from config file
   */
  private static async getUserInfo(): Promise<{ email: string; scopes: string[] } | null> {
    const configPath = this.getConfigPath();
    try {
      const config = await fs.readJSON(configPath);
      return config.user || null;
    } catch {
      return null;
    }
  }

  /**
   * Save user info to config file
   */
  private static async saveUserInfo(user: { email: string; scopes: string[] }): Promise<void> {
    const configPath = this.getConfigPath();
    const config = await this.getConfig();
    config.user = user;
    await fs.writeJSON(configPath, config, { spaces: 2 });
  }

  /**
   * Clear user info
   */
  private static async clearUserInfo(): Promise<void> {
    const configPath = this.getConfigPath();
    const config = await this.getConfig();
    delete config.user;
    await fs.writeJSON(configPath, config, { spaces: 2 });
  }

  /**
   * Get config file path
   */
  private static getConfigPath(): string {
    const homeDir = os.homedir();
    return path.join(homeDir, '.0xmart', 'config.json');
  }

  /**
   * Get full config
   */
  private static async getConfig(): Promise<any> {
    const configPath = this.getConfigPath();
    try {
      return await fs.readJSON(configPath);
    } catch {
      await fs.ensureFile(configPath);
      return {};
    }
  }
}
```

---

### 2. API Client Module

**File:** `src/lib/api/client.ts`

```typescript
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { AuthManager } from './auth';

const API_BASE_URL = process.env.OXMART_API_URL || 'https://api.0xmart.com/api/v1';

export class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': '0xmart-cli/1.0.0'
      }
    });

    // Add auth interceptor
    this.client.interceptors.request.use(async (config) => {
      const apiKey = await AuthManager.getApiKey();
      if (apiKey) {
        config.headers['X-API-Key'] = apiKey;
      }
      return config;
    });

    // Add error interceptor
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          throw new Error('Unauthorized. Please login: 0xmart login');
        }
        if (error.response?.status === 403) {
          throw new Error('Forbidden. Check your API key permissions');
        }
        if (error.response?.data?.message) {
          throw new Error(error.response.data.message);
        }
        throw error;
      }
    );
  }

  /**
   * Get ad recommendations
   */
  async getAdRecommendations(filters?: {
    category?: string;
    budget?: number;
    network?: string;
  }): Promise<Ad[]> {
    const { data } = await this.client.post('/ads/get-recommendations', filters);
    return data.ads;
  }

  /**
   * Track ad click
   */
  async trackAdClick(adId: string): Promise<{ clickToken: string }> {
    const { data } = await this.client.post('/ads/open', { adId });
    return data;
  }

  /**
   * Initiate payment
   */
  async initiatePayment(params: {
    adId: string;
    customerEmail?: string;
    network?: string;
  }): Promise<PaymentDetails> {
    const { data } = await this.client.post('/payment/initiate', params);
    return data;
  }

  /**
   * Confirm payment
   */
  async confirmPayment(params: {
    paymentId: string;
    txHash: string;
    network: string;
  }): Promise<{ success: boolean; orderId: string }> {
    const { data } = await this.client.post('/payment/confirm', params);
    return data;
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(paymentId: string): Promise<Payment> {
    const { data } = await this.client.get(`/payment/${paymentId}`);
    return data;
  }

  /**
   * Get transaction history
   */
  async getTransactionHistory(filters?: {
    status?: string;
    network?: string;
    limit?: number;
  }): Promise<Transaction[]> {
    const { data } = await this.client.get('/transactions', { params: filters });
    return data.transactions;
  }
}

// Types
export interface Ad {
  id: string;
  productId: string;
  productName: string;
  price: string;
  currency: string;
  network: string;
  commission: string;
  imageUrl: string;
}

export interface PaymentDetails {
  paymentId: string;
  orderId: string;
  amount: string;
  currency: string;
  network: string;
  contractAddress: string;
  recipientAddress: string;
  deadline: number;
  signature: string;
}

export interface Payment {
  id: string;
  orderId: string;
  amount: string;
  currency: string;
  status: 'pending' | 'completed' | 'failed';
  txHash?: string;
  network: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  paymentId: string;
  txHash: string;
  amount: string;
  currency: string;
  network: string;
  status: string;
  createdAt: string;
}
```

---

### 3. Wallet Abstraction Module

**File:** `src/lib/wallet/custodial.ts`

```typescript
import { Wallet } from 'ethers';
import { ApiClient } from '../api/client';

export class CustodialWallet {
  private apiClient: ApiClient;

  constructor() {
    this.apiClient = new ApiClient();
  }

  /**
   * Get wallet info (address, balance)
   */
  async getInfo(): Promise<{
    address: string;
    balances: { network: string; currency: string; amount: string }[];
  }> {
    // Call backend API to get custodial wallet info
    const { data } = await this.apiClient.client.get('/wallets/custodial');
    return data;
  }

  /**
   * Execute payment (backend signs transaction)
   */
  async executePayment(params: {
    paymentId: string;
    network: string;
    amount: string;
  }): Promise<{ txHash: string }> {
    // Backend wallet signs and submits transaction
    const { data } = await this.apiClient.client.post('/wallets/custodial/execute-payment', params);
    return data;
  }

  /**
   * Fund wallet (get deposit address)
   */
  async getFundingAddress(network: string): Promise<{ address: string; qrCode: string }> {
    const { data } = await this.apiClient.client.get(`/wallets/custodial/deposit-address`, {
      params: { network }
    });
    return data;
  }

  /**
   * Withdraw from custodial wallet
   */
  async withdraw(params: {
    network: string;
    amount: string;
    to: string;
  }): Promise<{ txHash: string }> {
    const { data } = await this.apiClient.client.post('/wallets/custodial/withdraw', params);
    return data;
  }
}
```

**File:** `src/lib/wallet/non-custodial.ts`

```typescript
import { Wallet, providers } from 'ethers';
import * as crypto from 'crypto';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

export class NonCustodialWallet {
  private wallet: Wallet | null = null;

  /**
   * Create new wallet
   */
  async create(password: string): Promise<{ address: string; mnemonic: string }> {
    const wallet = Wallet.createRandom();
    await this.saveEncryptedWallet(wallet, password);

    return {
      address: wallet.address,
      mnemonic: wallet.mnemonic?.phrase || ''
    };
  }

  /**
   * Import existing wallet
   */
  async import(privateKeyOrMnemonic: string, password: string): Promise<{ address: string }> {
    let wallet: Wallet;

    if (privateKeyOrMnemonic.includes(' ')) {
      // Mnemonic phrase
      wallet = Wallet.fromMnemonic(privateKeyOrMnemonic);
    } else {
      // Private key
      wallet = new Wallet(privateKeyOrMnemonic);
    }

    await this.saveEncryptedWallet(wallet, password);

    return { address: wallet.address };
  }

  /**
   * Unlock wallet
   */
  async unlock(password: string): Promise<Wallet> {
    const encryptedWallet = await this.loadEncryptedWallet();
    const decryptedPrivateKey = this.decrypt(encryptedWallet.encryptedPrivateKey, password);

    this.wallet = new Wallet(decryptedPrivateKey);
    return this.wallet;
  }

  /**
   * Sign transaction
   */
  async signTransaction(tx: any, password: string): Promise<string> {
    if (!this.wallet) {
      await this.unlock(password);
    }

    return await this.wallet!.signTransaction(tx);
  }

  /**
   * Get address
   */
  async getAddress(): Promise<string> {
    const encryptedWallet = await this.loadEncryptedWallet();
    return encryptedWallet.address;
  }

  /**
   * Export private key
   */
  async exportPrivateKey(password: string): Promise<string> {
    if (!this.wallet) {
      await this.unlock(password);
    }

    return this.wallet!.privateKey;
  }

  /**
   * Save encrypted wallet to disk
   */
  private async saveEncryptedWallet(wallet: Wallet, password: string): Promise<void> {
    const encryptedPrivateKey = this.encrypt(wallet.privateKey, password);

    const walletData = {
      address: wallet.address,
      encryptedPrivateKey,
      createdAt: new Date().toISOString()
    };

    const walletPath = this.getWalletPath();
    await fs.ensureFile(walletPath);
    await fs.writeJSON(walletPath, walletData, { spaces: 2 });
  }

  /**
   * Load encrypted wallet from disk
   */
  private async loadEncryptedWallet(): Promise<{ address: string; encryptedPrivateKey: string }> {
    const walletPath = this.getWalletPath();
    return await fs.readJSON(walletPath);
  }

  /**
   * Encrypt data with password
   */
  private encrypt(text: string, password: string): string {
    const algorithm = 'aes-256-gcm';
    const salt = crypto.randomBytes(16);
    const key = crypto.scryptSync(password, salt, 32);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return JSON.stringify({
      encrypted,
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    });
  }

  /**
   * Decrypt data with password
   */
  private decrypt(encryptedData: string, password: string): string {
    const { encrypted, salt, iv, authTag } = JSON.parse(encryptedData);

    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(password, Buffer.from(salt, 'hex'), 32);

    const decipher = crypto.createDecipheriv(
      algorithm,
      key,
      Buffer.from(iv, 'hex')
    );
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Get wallet file path
   */
  private getWalletPath(): string {
    const homeDir = os.homedir();
    return path.join(homeDir, '.0xmart', 'wallet.json');
  }
}
```

---

### 4. Payment Executor Module

**File:** `src/lib/payment/executor.ts`

```typescript
import { ethers, Contract, providers } from 'ethers';
import { CliUx } from '@oclif/core';
import { ApiClient, PaymentDetails } from '../api/client';
import { CustodialWallet } from '../wallet/custodial';
import { NonCustodialWallet } from '../wallet/non-custodial';
import { ConfigManager } from '../config/manager';

const PAYMENT_CONTRACT_ABI = [
  'function payForProduct(uint256 orderId, uint256 amount) external',
  'event PaymentProcessed(uint256 indexed orderId, address indexed payer, uint256 amount, uint256 commission)'
];

export class PaymentExecutor {
  private apiClient: ApiClient;

  constructor() {
    this.apiClient = new ApiClient();
  }

  /**
   * Execute payment for an ad
   */
  async executePayment(adId: string, options?: {
    network?: string;
    dryRun?: boolean;
  }): Promise<{ txHash: string; orderId: string }> {
    CliUx.ux.action.start('Initiating payment');

    try {
      // Step 1: Track ad click
      const { clickToken } = await this.apiClient.trackAdClick(adId);

      // Step 2: Initiate payment
      const paymentDetails = await this.apiClient.initiatePayment({
        adId,
        network: options?.network
      });

      CliUx.ux.action.stop('✅');

      // Step 3: Verify signature (anti-phishing)
      this.verifyPaymentSignature(paymentDetails);

      // Step 4: Display payment details
      this.displayPaymentDetails(paymentDetails);

      // Step 5: Confirm with user
      if (!options?.dryRun) {
        const confirmed = await CliUx.ux.confirm('Proceed with payment? (y/n)');
        if (!confirmed) {
          throw new Error('Payment cancelled by user');
        }
      }

      if (options?.dryRun) {
        CliUx.ux.log('✅ Dry run successful. Transaction would proceed.');
        return { txHash: 'DRY_RUN', orderId: paymentDetails.orderId };
      }

      // Step 6: Execute transaction
      CliUx.ux.action.start('Executing transaction');
      const txHash = await this.submitTransaction(paymentDetails);
      CliUx.ux.action.stop('✅');

      // Step 7: Wait for confirmation
      CliUx.ux.action.start('Waiting for blockchain confirmation');
      await this.waitForConfirmation(txHash, paymentDetails.network);
      CliUx.ux.action.stop('✅');

      // Step 8: Confirm payment with backend
      await this.apiClient.confirmPayment({
        paymentId: paymentDetails.paymentId,
        txHash,
        network: paymentDetails.network
      });

      CliUx.ux.log(`\n✅ Payment successful!`);
      CliUx.ux.log(`Transaction: ${txHash}`);
      CliUx.ux.log(`Order ID: ${paymentDetails.orderId}`);
      CliUx.ux.log(`View on Explorer: ${this.getExplorerUrl(txHash, paymentDetails.network)}`);

      return { txHash, orderId: paymentDetails.orderId };
    } catch (error: any) {
      CliUx.ux.action.stop('❌');
      throw error;
    }
  }

  /**
   * Submit transaction to blockchain
   */
  private async submitTransaction(paymentDetails: PaymentDetails): Promise<string> {
    const config = await ConfigManager.getConfig();
    const walletMode = config.walletMode || 'custodial';

    if (walletMode === 'custodial') {
      return await this.submitCustodialTransaction(paymentDetails);
    } else {
      return await this.submitNonCustodialTransaction(paymentDetails);
    }
  }

  /**
   * Submit transaction using custodial wallet
   */
  private async submitCustodialTransaction(paymentDetails: PaymentDetails): Promise<string> {
    const custodialWallet = new CustodialWallet();
    const { txHash } = await custodialWallet.executePayment({
      paymentId: paymentDetails.paymentId,
      network: paymentDetails.network,
      amount: paymentDetails.amount
    });
    return txHash;
  }

  /**
   * Submit transaction using non-custodial wallet
   */
  private async submitNonCustodialTransaction(paymentDetails: PaymentDetails): Promise<string> {
    const password = await CliUx.ux.prompt('Enter wallet password', { type: 'mask' });

    const nonCustodialWallet = new NonCustodialWallet();
    const wallet = await nonCustodialWallet.unlock(password);

    // Connect to RPC
    const provider = this.getProvider(paymentDetails.network);
    const connectedWallet = wallet.connect(provider);

    // Prepare contract call
    const contract = new Contract(
      paymentDetails.contractAddress,
      PAYMENT_CONTRACT_ABI,
      connectedWallet
    );

    // Estimate gas
    const gasEstimate = await contract.estimateGas.payForProduct(
      paymentDetails.orderId,
      ethers.utils.parseUnits(paymentDetails.amount, 6) // USDC has 6 decimals
    );

    // Add 20% buffer
    const gasLimit = gasEstimate.mul(120).div(100);

    // Submit transaction
    const tx = await contract.payForProduct(
      paymentDetails.orderId,
      ethers.utils.parseUnits(paymentDetails.amount, 6),
      { gasLimit }
    );

    return tx.hash;
  }

  /**
   * Wait for transaction confirmation
   */
  private async waitForConfirmation(txHash: string, network: string): Promise<void> {
    const provider = this.getProvider(network);
    const receipt = await provider.waitForTransaction(txHash, 3); // Wait for 3 confirmations

    if (receipt.status !== 1) {
      throw new Error('Transaction failed on-chain');
    }
  }

  /**
   * Verify payment signature (anti-phishing)
   */
  private verifyPaymentSignature(paymentDetails: PaymentDetails): void {
    // TODO: Implement signature verification using platform public key
    // This prevents man-in-the-middle attacks
  }

  /**
   * Display payment details
   */
  private displayPaymentDetails(paymentDetails: PaymentDetails): void {
    CliUx.ux.log('\n┌─────────────────────────────────────┐');
    CliUx.ux.log('│ 🔒 0xMart Secure Payment            │');
    CliUx.ux.log('├─────────────────────────────────────┤');
    CliUx.ux.log(`│ Amount: ${paymentDetails.amount} ${paymentDetails.currency}`);
    CliUx.ux.log(`│ Network: ${paymentDetails.network}`);
    CliUx.ux.log(`│ Order ID: ${paymentDetails.orderId}`);
    CliUx.ux.log('└─────────────────────────────────────┘\n');
  }

  /**
   * Get RPC provider for network
   */
  private getProvider(network: string): providers.JsonRpcProvider {
    const rpcUrls: { [key: string]: string } = {
      ethereum: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com',
      polygon: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
      bsc: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org',
      arbitrum: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc'
    };

    return new providers.JsonRpcProvider(rpcUrls[network.toLowerCase()]);
  }

  /**
   * Get block explorer URL
   */
  private getExplorerUrl(txHash: string, network: string): string {
    const explorers: { [key: string]: string } = {
      ethereum: 'https://etherscan.io/tx',
      polygon: 'https://polygonscan.com/tx',
      bsc: 'https://bscscan.com/tx',
      arbitrum: 'https://arbiscan.io/tx'
    };

    return `${explorers[network.toLowerCase()]}/${txHash}`;
  }
}
```

---

## CLI Commands Implementation

### Login Command

**File:** `src/commands/login.ts`

```typescript
import { Command, Flags } from '@oclif/core';
import { AuthManager } from '../lib/api/auth';

export default class Login extends Command {
  static description = 'Authenticate with your 0xMart API key';

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --key sk_live_abc123',
  ];

  static flags = {
    key: Flags.string({ char: 'k', description: 'API key' }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Login);

    try {
      await AuthManager.login(flags.key);
    } catch (error: any) {
      this.error(error.message);
    }
  }
}
```

### Pay Command

**File:** `src/commands/pay.ts`

```typescript
import { Command, Flags } from '@oclif/core';
import { PaymentExecutor } from '../lib/payment/executor';
import { AuthManager } from '../lib/api/auth';

export default class Pay extends Command {
  static description = 'Execute payment for an ad';

  static examples = [
    '<%= config.bin %> <%= command.id %> ad_123',
    '<%= config.bin %> <%= command.id %> ad_123 --network polygon',
    '<%= config.bin %> <%= command.id %> ad_123 --dry-run',
  ];

  static args = [
    { name: 'adId', description: 'Ad ID to pay for', required: true }
  ];

  static flags = {
    network: Flags.string({ char: 'n', description: 'Blockchain network' }),
    'dry-run': Flags.boolean({ description: 'Simulate payment without executing' }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Pay);

    // Check authentication
    const isAuthenticated = await AuthManager.isAuthenticated();
    if (!isAuthenticated) {
      this.error('Not authenticated. Run: 0xmart login');
    }

    try {
      const executor = new PaymentExecutor();
      await executor.executePayment(args.adId, {
        network: flags.network,
        dryRun: flags['dry-run']
      });
    } catch (error: any) {
      this.error(error.message);
    }
  }
}
```

---

## Security Implementation

### Anti-Phishing Mechanism

**File:** `src/lib/security/anti-phishing.ts`

```typescript
import * as crypto from 'crypto';

const PLATFORM_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
-----END PUBLIC KEY-----`;

export class AntiPhishing {
  /**
   * Verify platform signature
   */
  static verifySignature(payload: any, signature: string): boolean {
    const payloadString = JSON.stringify(payload);

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(payloadString);
    verifier.end();

    return verifier.verify(PLATFORM_PUBLIC_KEY, signature, 'base64');
  }

  /**
   * Verify API domain
   */
  static verifyDomain(url: string): void {
    const allowedDomains = ['api.0xmart.com', 'api-staging.0xmart.com'];
    const domain = new URL(url).hostname;

    if (!allowedDomains.includes(domain)) {
      throw new Error(`Untrusted domain: ${domain}. Potential phishing attack.`);
    }
  }
}
```

---

## Configuration Management

**File:** `src/lib/config/manager.ts`

```typescript
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

export interface Config {
  walletMode: 'custodial' | 'non-custodial';
  network: string;
  telemetry: boolean;
  user?: {
    email: string;
    scopes: string[];
  };
}

export class ConfigManager {
  private static configPath = path.join(os.homedir(), '.0xmart', 'config.json');

  /**
   * Get config
   */
  static async getConfig(): Promise<Config> {
    try {
      return await fs.readJSON(this.configPath);
    } catch {
      return this.getDefaultConfig();
    }
  }

  /**
   * Set config value
   */
  static async set(key: string, value: any): Promise<void> {
    const config = await this.getConfig();
    config[key] = value;
    await fs.ensureFile(this.configPath);
    await fs.writeJSON(this.configPath, config, { spaces: 2 });
  }

  /**
   * Get default config
   */
  private static getDefaultConfig(): Config {
    return {
      walletMode: 'custodial',
      network: 'polygon',
      telemetry: true
    };
  }

  /**
   * Reset config
   */
  static async reset(): Promise<void> {
    const defaultConfig = this.getDefaultConfig();
    await fs.writeJSON(this.configPath, defaultConfig, { spaces: 2 });
  }
}
```

---

## Next Steps

1. **Implement CLI** using oclif framework
2. **Test authentication flow** with backend API
3. **Implement custodial wallet** backend endpoints
4. **Test payment execution** end-to-end
5. **Add hardware wallet support** (Ledger, Trezor)
6. **Publish to NPM** as `@0xmart/cli`
7. **Create developer documentation**
8. **Setup auto-update mechanism**

This CLI gives 0xMart **Stripe-level control** over the payment flow while abstracting all wallet complexity from developers.
