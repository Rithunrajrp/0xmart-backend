import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16; // 128 bits
  private readonly tagLength = 16; // 128 bits
  private readonly saltLength = 64;

  /**
   * Get encryption key from environment variable
   * In production, this should be stored in a secure vault (AWS KMS, Google Cloud KMS)
   */
  private getEncryptionKey(): Buffer {
    const key = process.env.MASTER_KEY_ENCRYPTION_SECRET;
    if (!key) {
      throw new Error(
        'MASTER_KEY_ENCRYPTION_SECRET environment variable is required',
      );
    }

    // Derive a key from the secret using PBKDF2
    const salt = Buffer.from(
      process.env.MASTER_KEY_ENCRYPTION_SALT || 'default-salt-0xmart',
      'utf8',
    );
    return crypto.pbkdf2Sync(key, salt, 100000, this.keyLength, 'sha256');
  }

  /**
   * Encrypt sensitive data using AES-256-GCM
   * @param plaintext - The data to encrypt
   * @returns Base64 encoded string containing IV + encrypted data + auth tag
   */
  encrypt(plaintext: string): string {
    try {
      const key = this.getEncryptionKey();
      const iv = crypto.randomBytes(this.ivLength);

      const cipher = crypto.createCipheriv(this.algorithm, key, iv);

      let encrypted = cipher.update(plaintext, 'utf8', 'base64');
      encrypted += cipher.final('base64');

      const authTag = cipher.getAuthTag();

      // Combine IV + encrypted data + auth tag
      const combined = Buffer.concat([
        iv,
        Buffer.from(encrypted, 'base64'),
        authTag,
      ]);

      return combined.toString('base64');
    } catch (error) {
      this.logger.error('Encryption failed', error.stack);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt data encrypted with AES-256-GCM
   * @param encryptedData - Base64 encoded string containing IV + encrypted data + auth tag
   * @returns Decrypted plaintext string
   */
  decrypt(encryptedData: string): string {
    try {
      const key = this.getEncryptionKey();
      const combined = Buffer.from(encryptedData, 'base64');

      // Extract IV, encrypted data, and auth tag
      const iv = combined.subarray(0, this.ivLength);
      const authTag = combined.subarray(combined.length - this.tagLength);
      const encrypted = combined.subarray(
        this.ivLength,
        combined.length - this.tagLength,
      );

      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, undefined, 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      this.logger.error('Decryption failed', error.stack);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Generate a cryptographically secure random key
   * @param length - Length in bytes (default 32 for 256-bit)
   * @returns Hex string of random bytes
   */
  generateRandomKey(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Hash data using SHA-256
   * @param data - Data to hash
   * @returns Hex string of hash
   */
  hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Compare a plaintext with its hash
   * @param plaintext - Original data
   * @param hash - Hash to compare against
   * @returns True if they match
   */
  compareHash(plaintext: string, hash: string): boolean {
    return this.hash(plaintext) === hash;
  }
}
