import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor(private readonly configService: ConfigService) {
    const rawKey = this.configService.get<string>(
      'CRYPTO_KEY',
      'default_development_crypto_key_32b_!',
    );
    // Derive exactly 32 bytes via SHA-256 to ensure valid key length
    this.key = crypto.createHash('sha256').update(rawKey).digest();
  }

  /**
   * Encrypts an object or string into a string format: iv:authTag:ciphertext (hex)
   */
  encrypt(data: unknown): string {
    const text = typeof data === 'string' ? data : JSON.stringify(data);
    const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  /**
   * Decrypts an encrypted string (iv:authTag:ciphertext) back to its original parsed object or string
   */
  decrypt<T = unknown>(encryptedText: string): T {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      throw new Error(
        'Invalid encrypted text format. Expected iv:authTag:ciphertext',
      );
    }

    const [ivHex, authTagHex, encryptedDataHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);

    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedDataHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    try {
      return JSON.parse(decrypted) as T;
    } catch {
      return decrypted as unknown as T;
    }
  }

  /**
   * Encrypts connection config for database storage
   */
  encryptConfig(
    config: Record<string, unknown> | null | undefined,
  ): Record<string, unknown> {
    if (!config || Object.keys(config).length === 0) {
      return {};
    }
    return {
      _encrypted: this.encrypt(config),
    };
  }

  /**
   * Decrypts connection config from database representation
   */
  decryptConfig(
    storedConfig: Record<string, unknown> | null | undefined,
  ): Record<string, unknown> {
    if (!storedConfig || typeof storedConfig !== 'object') {
      return {};
    }

    if (typeof storedConfig._encrypted === 'string') {
      try {
        return this.decrypt<Record<string, unknown>>(storedConfig._encrypted);
      } catch {
        return {};
      }
    }

    return storedConfig;
  }
}
