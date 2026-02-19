/**
 * AES-256-GCM encryption for Spotify access and refresh tokens.
 *
 * To generate a secure 32-byte encryption key:
 * ```bash
 * node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 * ```
 * Then set TOKEN_ENCRYPTION_KEY in your .env file.
 *
 * If TOKEN_ENCRYPTION_KEY is not set, tokens are stored in plaintext (local dev only).
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getKey(): Buffer {
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (!key) {
    // No encryption key = store tokens in plaintext (local dev)
    return Buffer.alloc(0);
  }
  const buf = Buffer.from(key, 'base64');
  if (buf.length !== 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be 32 bytes (base64-encoded)');
  }
  return buf;
}

/**
 * Encrypt a plaintext string. Returns `enc:<iv>:<authTag>:<ciphertext>` (all hex).
 * If no encryption key is configured, returns plaintext unchanged.
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  if (key.length === 0) return plaintext;

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `enc:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt a string produced by `encrypt()`. If the string doesn't start with `enc:`,
 * it's treated as unencrypted plaintext and returned as-is (migration-friendly).
 */
export function decrypt(ciphertext: string): string {
  if (!ciphertext.startsWith('enc:')) return ciphertext;

  const key = getKey();
  if (key.length === 0) {
    throw new Error('TOKEN_ENCRYPTION_KEY required to decrypt tokens');
  }

  const parts = ciphertext.split(':');
  if (parts.length !== 4) throw new Error('Invalid encrypted token format');

  const iv = Buffer.from(parts[1]!, 'hex');
  const authTag = Buffer.from(parts[2]!, 'hex');
  const encrypted = Buffer.from(parts[3]!, 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final('utf8');
}
