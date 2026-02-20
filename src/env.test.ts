import { describe, it, expect, vi, beforeEach } from 'vitest';

// Re-stub required env vars before each test to ensure they survive
// vi.stubEnv auto-restore that occurs after tests that override them.
beforeEach(() => {
  vi.stubEnv('IRON_SESSION_PASSWORD', 'test-password-that-is-at-least-32-characters-long');
  vi.stubEnv('POLL_SECRET', 'test-poll-secret-16chars');
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://test.swapify.app');
});

describe('validateEnv', () => {
  it('succeeds with all required env vars set', async () => {
    const { validateEnv } = await import('./env');
    const result = validateEnv();
    expect(result).toBeDefined();
    expect(result.IRON_SESSION_PASSWORD).toBe('test-password-that-is-at-least-32-characters-long');
    expect(result.POLL_SECRET).toBe('test-poll-secret-16chars');
    expect(result.NEXT_PUBLIC_APP_URL).toBe('https://test.swapify.app');
  });

  it('throws when IRON_SESSION_PASSWORD is too short', async () => {
    vi.stubEnv('IRON_SESSION_PASSWORD', 'short');
    const { validateEnv } = await import('./env');
    expect(() => validateEnv()).toThrow('IRON_SESSION_PASSWORD must be at least 32 characters');
  });

  it('throws when POLL_SECRET is too short', async () => {
    vi.stubEnv('POLL_SECRET', 'short');
    const { validateEnv } = await import('./env');
    expect(() => validateEnv()).toThrow('POLL_SECRET must be at least 16 characters');
  });

  it('throws when NEXT_PUBLIC_APP_URL is not a valid URL', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'not-a-url');
    const { validateEnv } = await import('./env');
    expect(() => validateEnv()).toThrow('NEXT_PUBLIC_APP_URL must be a valid URL');
  });

  it('defaults POLL_INTERVAL_MS to 30000 when unset', async () => {
    const { validateEnv } = await import('./env');
    const result = validateEnv();
    expect(result.POLL_INTERVAL_MS).toBe(30000);
  });

  it('coerces POLL_INTERVAL_MS from string to number', async () => {
    vi.stubEnv('POLL_INTERVAL_MS', '15000');
    const { validateEnv } = await import('./env');
    const result = validateEnv();
    expect(result.POLL_INTERVAL_MS).toBe(15000);
    expect(typeof result.POLL_INTERVAL_MS).toBe('number');
  });

  it('allows optional vars to be absent without error', async () => {
    const { validateEnv } = await import('./env');
    const result = validateEnv();
    expect(result.DATABASE_URL).toBeUndefined();
    expect(result.RESEND_API_KEY).toBeUndefined();
    expect(result.TOKEN_ENCRYPTION_KEY).toBeUndefined();
    expect(result.VAPID_PRIVATE_KEY).toBeUndefined();
  });
});

describe('env proxy', () => {
  it('triggers validation on property access', async () => {
    const { env } = await import('./env');
    // Accessing a property through the proxy should trigger validateEnv()
    // and return the validated value
    expect(env.IRON_SESSION_PASSWORD).toBe('test-password-that-is-at-least-32-characters-long');
    expect(env.NEXT_PUBLIC_APP_URL).toBe('https://test.swapify.app');
  });

  it('throws on property access when env is invalid', async () => {
    vi.stubEnv('IRON_SESSION_PASSWORD', 'bad');
    const { env } = await import('./env');
    expect(() => env.IRON_SESSION_PASSWORD).toThrow('Environment validation failed');
  });
});
