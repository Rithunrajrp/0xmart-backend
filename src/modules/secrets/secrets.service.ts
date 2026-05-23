import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

/**
 * SEC-BE-003 FIX: Secrets Service for secure private key management
 *
 * This service provides secure access to sensitive secrets like private keys.
 * It supports multiple backends:
 * 1. AWS Secrets Manager (Production recommended)
 * 2. Environment variables (Development/Fallback)
 *
 * Usage:
 * - Production: Configure AWS_SECRETS_MANAGER_ENABLED=true and AWS credentials
 * - Development: Set private keys in .env (NOT committed to git)
 */
@Injectable()
export class SecretsService implements OnModuleInit {
  private readonly logger = new Logger(SecretsService.name);
  private secretsManagerClient: SecretsManagerClient | null = null;
  private useSecretsManager = false;
  private secretsCache = new Map<string, { value: string; expiry: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const enabled = this.configService.get<string>('AWS_SECRETS_MANAGER_ENABLED') === 'true';
    const region = this.configService.get<string>('AWS_REGION');
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');

    if (enabled && region) {
      try {
        this.secretsManagerClient = new SecretsManagerClient({
          region,
          ...(accessKeyId && secretAccessKey
            ? { credentials: { accessKeyId, secretAccessKey } }
            : {}), // Uses IAM role if credentials not provided
        });
        this.useSecretsManager = true;
        this.logger.log(`✅ AWS Secrets Manager enabled (region: ${region})`);
      } catch (error) {
        this.logger.error('❌ Failed to initialize AWS Secrets Manager:', error.message);
        this.logger.warn('⚠️  Falling back to environment variables (NOT PRODUCTION SAFE)');
      }
    } else {
      this.logger.warn('⚠️  AWS Secrets Manager not configured. Using environment variables.');
      this.logger.warn('⚠️  For production, enable AWS Secrets Manager: AWS_SECRETS_MANAGER_ENABLED=true');
    }
  }

  /**
   * Get master wallet private key (for payment distribution)
   */
  async getMasterWalletPrivateKey(): Promise<string> {
    if (this.useSecretsManager) {
      return this.getSecretFromAWS('oxmart/master-wallet-private-key', 'MASTER_WALLET_PRIVATE_KEY');
    }
    return this.getSecretFromEnv('MASTER_WALLET_PRIVATE_KEY');
  }

  /**
   * Get hot wallet private key (for withdrawals)
   * Network-specific keys for different blockchains
   */
  async getHotWalletPrivateKey(network: 'SUI' | 'SOLANA' | 'TON'): Promise<string> {
    const envKey = `${network}_HOT_WALLET_PRIVATE_KEY`;
    const secretId = `oxmart/hot-wallet-private-key-${network.toLowerCase()}`;

    if (this.useSecretsManager) {
      return this.getSecretFromAWS(secretId, envKey);
    }
    return this.getSecretFromEnv(envKey);
  }

  /**
   * Retrieve secret from AWS Secrets Manager with caching
   */
  private async getSecretFromAWS(secretId: string, fallbackEnvKey: string): Promise<string> {
    // Check cache first
    const cached = this.secretsCache.get(secretId);
    if (cached && Date.now() < cached.expiry) {
      return cached.value;
    }

    try {
      const command = new GetSecretValueCommand({ SecretId: secretId });
      if (!this.secretsManagerClient) {
        throw new Error('Secrets Manager client not initialized');
      }
      const response = await this.secretsManagerClient.send(command);

      let secret: string;
      if (response.SecretString) {
        // Handle JSON secrets
        try {
          const parsed = JSON.parse(response.SecretString);
          secret = parsed.privateKey || parsed.value || response.SecretString;
        } catch {
          secret = response.SecretString;
        }
      } else if (response.SecretBinary) {
        secret = Buffer.from(response.SecretBinary).toString('utf-8');
      } else {
        throw new Error('Secret has no value');
      }

      // Cache the secret
      this.secretsCache.set(secretId, {
        value: secret,
        expiry: Date.now() + this.CACHE_TTL,
      });

      this.logger.log(`✅ Retrieved secret from AWS Secrets Manager: ${secretId}`);
      return secret;
    } catch (error) {
      this.logger.error(`❌ Failed to retrieve secret from AWS: ${secretId}`, error.message);
      this.logger.warn(`⚠️  Falling back to environment variable: ${fallbackEnvKey}`);
      return this.getSecretFromEnv(fallbackEnvKey);
    }
  }

  /**
   * Retrieve secret from environment variables (fallback)
   */
  private getSecretFromEnv(envKey: string): string {
    const value = this.configService.get<string>(envKey);
    if (!value) {
      throw new Error(
        `Secret not found: ${envKey} is not set in environment variables or AWS Secrets Manager`,
      );
    }

    // Warn if using env vars in production
    const nodeEnv = this.configService.get<string>('NODE_ENV');
    const productionMode = this.configService.get<string>('PRODUCTION_MODE') === 'true';
    if (nodeEnv === 'production' || productionMode) {
      this.logger.error(
        `🔴 SECURITY WARNING: Using environment variable for sensitive secret in production: ${envKey}`,
      );
      this.logger.error('🔴 Enable AWS Secrets Manager for production deployments!');
    }

    return value;
  }

  /**
   * Clear secrets cache (for key rotation)
   */
  clearCache() {
    this.secretsCache.clear();
    this.logger.log('Secrets cache cleared');
  }

  /**
   * Clear specific secret from cache
   */
  clearSecret(secretId: string) {
    this.secretsCache.delete(secretId);
    this.logger.log(`Secret cleared from cache: ${secretId}`);
  }
}
