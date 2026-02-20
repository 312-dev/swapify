import { describe, it, expect, vi, beforeEach } from 'vitest';
import { randomBytes } from 'crypto';
import { encrypt, decrypt } from '../crypto';

// Generate a valid 32-byte AES-256 key for tests
const TEST_KEY = randomBytes(32).toString('base64');

describe('crypto', () => {
  beforeEach(() => {
    // Clear the key before each test so tests are independent
    vi.stubEnv('TOKEN_ENCRYPTION_KEY', '');
  });

  // ─── Round-trip ─────────────────────────────────────────────────────────────

  describe('encrypt/decrypt round-trip', () => {
    it('decrypts back to the original plaintext', () => {
      vi.stubEnv('TOKEN_ENCRYPTION_KEY', TEST_KEY);
      const plaintext = 'my-secret-spotify-token-abc123';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });
  });

  // ─── Encrypted format ───────────────────────────────────────────────────────

  describe('encrypted format', () => {
    it('starts with "enc:"', () => {
      vi.stubEnv('TOKEN_ENCRYPTION_KEY', TEST_KEY);
      const encrypted = encrypt('test');
      expect(encrypted.startsWith('enc:')).toBe(true);
    });

    it('has 4 colon-separated parts', () => {
      vi.stubEnv('TOKEN_ENCRYPTION_KEY', TEST_KEY);
      const encrypted = encrypt('test');
      const parts = encrypted.split(':');
      expect(parts.length).toBe(4);
    });
  });

  // ─── No-op without key ─────────────────────────────────────────────────────

  describe('without TOKEN_ENCRYPTION_KEY', () => {
    it('encrypt returns plaintext unchanged', () => {
      vi.stubEnv('TOKEN_ENCRYPTION_KEY', '');
      const plaintext = 'unencrypted-token';
      expect(encrypt(plaintext)).toBe(plaintext);
    });

    it('decrypt returns non-prefixed plaintext unchanged (backward compatible)', () => {
      vi.stubEnv('TOKEN_ENCRYPTION_KEY', '');
      const plaintext = 'some-legacy-token';
      expect(decrypt(plaintext)).toBe(plaintext);
    });
  });

  // ─── Error cases ────────────────────────────────────────────────────────────

  describe('error cases', () => {
    it('throws on invalid encrypted format (too few parts)', () => {
      vi.stubEnv('TOKEN_ENCRYPTION_KEY', TEST_KEY);
      expect(() => decrypt('enc:bad')).toThrow('Invalid encrypted token format');
    });

    it('throws when decrypting tampered ciphertext', () => {
      vi.stubEnv('TOKEN_ENCRYPTION_KEY', TEST_KEY);
      const encrypted = encrypt('sensitive-data');
      const parts = encrypted.split(':');
      // Tamper with the ciphertext portion (last part)
      const tampered = parts[3]!;
      const flipped = tampered[0] === 'a' ? 'b' + tampered.slice(1) : 'a' + tampered.slice(1);
      const tamperedCiphertext = `${parts[0]}:${parts[1]}:${parts[2]}:${flipped}`;
      expect(() => decrypt(tamperedCiphertext)).toThrow();
    });
  });
});
