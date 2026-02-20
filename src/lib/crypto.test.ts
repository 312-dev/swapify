import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { randomBytes } from 'crypto';

// Generate a valid 32-byte test key
const TEST_KEY = randomBytes(32).toString('base64');

describe('crypto', () => {
  let encrypt: typeof import('./crypto').encrypt;
  let decrypt: typeof import('./crypto').decrypt;

  beforeEach(async () => {
    // Fresh import each test so getKey() picks up env changes
    const mod = await import('./crypto');
    encrypt = mod.encrypt;
    decrypt = mod.decrypt;
  });

  afterEach(() => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
  });

  describe('without TOKEN_ENCRYPTION_KEY', () => {
    beforeEach(() => {
      delete process.env.TOKEN_ENCRYPTION_KEY;
    });

    it('encrypt returns plaintext unchanged', () => {
      expect(encrypt('my-secret-token')).toBe('my-secret-token');
    });

    it('decrypt returns non-prefixed string unchanged', () => {
      expect(decrypt('my-secret-token')).toBe('my-secret-token');
    });

    it('decrypt throws when encountering enc: prefix without key', () => {
      expect(() => decrypt('enc:aaa:bbb:ccc')).toThrow(
        'TOKEN_ENCRYPTION_KEY required to decrypt tokens'
      );
    });
  });

  describe('with TOKEN_ENCRYPTION_KEY', () => {
    beforeEach(() => {
      process.env.TOKEN_ENCRYPTION_KEY = TEST_KEY;
    });

    it('encrypt returns a string with enc: prefix', () => {
      const result = encrypt('hello');
      expect(result.startsWith('enc:')).toBe(true);
    });

    it('encrypted output has 4 colon-separated parts', () => {
      const result = encrypt('hello');
      const parts = result.split(':');
      expect(parts).toHaveLength(4);
      expect(parts[0]).toBe('enc');
    });

    it('round-trip encrypt then decrypt returns original', () => {
      const original = 'my-spotify-access-token-12345';
      const encrypted = encrypt(original);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(original);
    });

    it('produces unique ciphertexts due to random IV', () => {
      const text = 'same-plaintext';
      const a = encrypt(text);
      const b = encrypt(text);
      expect(a).not.toBe(b);
      // But both decrypt to the same value
      expect(decrypt(a)).toBe(text);
      expect(decrypt(b)).toBe(text);
    });

    it('handles empty string', () => {
      const encrypted = encrypt('');
      expect(encrypted.startsWith('enc:')).toBe(true);
      expect(decrypt(encrypted)).toBe('');
    });

    it('handles unicode characters', () => {
      const unicode = 'token-with-emoji-\u{1F3B5}-and-\u00FC\u00F1\u00EE\u00E7\u00F8d\u00E9';
      const encrypted = encrypt(unicode);
      expect(decrypt(encrypted)).toBe(unicode);
    });

    it('handles long strings', () => {
      const long = 'a'.repeat(10000);
      const encrypted = encrypt(long);
      expect(decrypt(encrypted)).toBe(long);
    });

    it('decrypt passes through plaintext without enc: prefix', () => {
      expect(decrypt('not-encrypted')).toBe('not-encrypted');
    });

    it('throws on tampered ciphertext', () => {
      const encrypted = encrypt('secret');
      const parts = encrypted.split(':');
      // Tamper with the encrypted data
      parts[3] = 'deadbeef';
      const tampered = parts.join(':');
      expect(() => decrypt(tampered)).toThrow();
    });

    it('throws on tampered auth tag', () => {
      const encrypted = encrypt('secret');
      const parts = encrypted.split(':');
      // Tamper with the auth tag
      parts[2] = '00000000000000000000000000000000';
      const tampered = parts.join(':');
      expect(() => decrypt(tampered)).toThrow();
    });

    it('throws on invalid format with wrong number of parts', () => {
      expect(() => decrypt('enc:only:two')).toThrow('Invalid encrypted token format');
    });
  });

  describe('invalid key', () => {
    it('throws for a key that is not 32 bytes', () => {
      process.env.TOKEN_ENCRYPTION_KEY = Buffer.from('short-key').toString('base64');
      expect(() => encrypt('hello')).toThrow('TOKEN_ENCRYPTION_KEY must be 32 bytes');
    });
  });
});
