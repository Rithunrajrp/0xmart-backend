import { createCipheriv, createDecipheriv, randomBytes, scrypt, CipherGCM, DecipherGCM } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

/**
 * Encryption utility for sensitive data like private keys
 * Uses AES-256-GCM for encryption with PBKDF2-derived keys
 *
 * SECURITY CRITICAL:
 * - Uses AES-256-GCM (authenticated encryption)
 * - Generates unique IV for each encryption
 * - Derives encryption key from master secret using scrypt
 * - Stores IV with ciphertext for decryption
 */
export class EncryptionUtil {
  private static algorithm = 'aes-256-gcm';
  private static keyLength = 32; // 256 bits
  private static ivLength = 16; // 128 bits
  private static authTagLength = 16; // 128 bits
  private static saltLength = 32; // 256 bits

  /**
   * Encrypt sensitive data (e.g., private keys)
   * @param plaintext Data to encrypt
   * @param secret Master encryption secret from environment
   * @returns Base64-encoded encrypted data with IV and auth tag
   */
  static async encrypt(plaintext: string, secret: string): Promise<string> {
    if (!plaintext) {
      throw new Error('Plaintext is required for encryption');
    }

    if (!secret || secret.length < 32) {
      throw new Error(
        'Encryption secret must be at least 32 characters long',
      );
    }

    try {
      // Generate random IV (initialization vector)
      const iv = randomBytes(this.ivLength);

      // Generate random salt for key derivation
      const salt = randomBytes(this.saltLength);

      // Derive encryption key from secret using scrypt
      const key = (await scryptAsync(secret, salt, this.keyLength)) as Buffer;

      // Create cipher (cast to CipherGCM for GCM mode)
      const cipher = createCipheriv(this.algorithm, key, iv) as CipherGCM;

      // Encrypt
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Get authentication tag
      const authTag = cipher.getAuthTag();

      // Combine salt + IV + authTag + encrypted data
      // Format: [salt(32)][iv(16)][authTag(16)][encrypted]
      const combined = Buffer.concat([
        salt,
        iv,
        authTag,
        Buffer.from(encrypted, 'hex'),
      ]);

      // Return as base64
      return combined.toString('base64');
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt encrypted data
   * @param encryptedData Base64-encoded encrypted data
   * @param secret Master encryption secret from environment
   * @returns Decrypted plaintext
   */
  static async decrypt(
    encryptedData: string,
    secret: string,
  ): Promise<string> {
    if (!encryptedData) {
      throw new Error('Encrypted data is required for decryption');
    }

    if (!secret || secret.length < 32) {
      throw new Error(
        'Encryption secret must be at least 32 characters long',
      );
    }

    try {
      // Decode from base64
      const combined = Buffer.from(encryptedData, 'base64');

      // Extract components
      const salt = combined.subarray(0, this.saltLength);
      const iv = combined.subarray(
        this.saltLength,
        this.saltLength + this.ivLength,
      );
      const authTag = combined.subarray(
        this.saltLength + this.ivLength,
        this.saltLength + this.ivLength + this.authTagLength,
      );
      const encrypted = combined.subarray(
        this.saltLength + this.ivLength + this.authTagLength,
      );

      // Derive encryption key from secret using same salt
      const key = (await scryptAsync(secret, salt, this.keyLength)) as Buffer;

      // Create decipher (cast to DecipherGCM for GCM mode)
      const decipher = createDecipheriv(this.algorithm, key, iv) as DecipherGCM;
      decipher.setAuthTag(authTag);

      // Decrypt
      let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Validate that encryption/decryption works correctly
   * Used for testing and startup validation
   */
  static async validateEncryption(secret: string): Promise<boolean> {
    try {
      const testData = 'test-private-key-validation';
      const encrypted = await this.encrypt(testData, secret);
      const decrypted = await this.decrypt(encrypted, secret);
      return decrypted === testData;
    } catch (error) {
      return false;
    }
  }
}
