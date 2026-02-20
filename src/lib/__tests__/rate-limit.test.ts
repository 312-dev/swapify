import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock next/server before any module imports
vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit & { headers?: Record<string, string> }) => ({
      body,
      status: init?.status ?? 200,
      headers: new Map(Object.entries(init?.headers ?? {})),
    }),
  },
}));

// Mock spotify-config so rate-limit.ts can import it without pulling in logger/pino
vi.mock('@/lib/spotify-config', () => ({
  isSpotifyDevMode: () => process.env.SPOTIFY_DEV_MODE === 'true',
}));

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows the first request (returns null)', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limit');
    const result = checkRateLimit('user-1', { maxTokens: 5, refillRate: 1 });
    expect(result).toBeNull();
  });

  it('allows multiple requests under maxTokens', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limit');
    const config = { maxTokens: 5, refillRate: 1 };

    // First request initializes with maxTokens - 1 = 4 tokens remaining
    // Subsequent requests each cost 1 token
    // So we should be able to make 5 total requests (1 init + 4 more)
    for (let i = 0; i < 5; i++) {
      const result = checkRateLimit('user-multi', config);
      expect(result).toBeNull();
    }
  });

  it('returns a 429 response when tokens are exhausted', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limit');
    const config = { maxTokens: 3, refillRate: 0.5 };

    // Use up all 3 tokens
    for (let i = 0; i < 3; i++) {
      checkRateLimit('user-exhaust', config);
    }

    // Next request should be blocked
    const blocked = checkRateLimit('user-exhaust', config);
    expect(blocked).not.toBeNull();
    expect(blocked!.status).toBe(429);
  });

  it('includes a Retry-After header in the 429 response', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limit');
    const config = { maxTokens: 2, refillRate: 0.5 };

    // Exhaust tokens
    checkRateLimit('user-retry', config);
    checkRateLimit('user-retry', config);

    const blocked = checkRateLimit('user-retry', config);
    expect(blocked).not.toBeNull();
    expect(blocked!.headers.get('Retry-After')).toBeDefined();
    const retryAfter = Number(blocked!.headers.get('Retry-After'));
    expect(retryAfter).toBeGreaterThan(0);
  });

  it('refills tokens after time passes', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limit');
    const config = { maxTokens: 2, refillRate: 1 }; // 1 token per second

    // Use all tokens
    checkRateLimit('user-refill', config);
    checkRateLimit('user-refill', config);

    // Should be blocked now
    expect(checkRateLimit('user-refill', config)).not.toBeNull();

    // Advance time by 3 seconds — should refill at least 2 tokens (rate=1/s)
    vi.advanceTimersByTime(3000);

    // Should be allowed again
    const result = checkRateLimit('user-refill', config);
    expect(result).toBeNull();
  });

  it('maintains independent buckets for different keys', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limit');
    const config = { maxTokens: 2, refillRate: 0.1 };

    // Exhaust tokens for key A
    checkRateLimit('key-A', config);
    checkRateLimit('key-A', config);
    expect(checkRateLimit('key-A', config)).not.toBeNull();

    // Key B should still be allowed
    const resultB = checkRateLimit('key-B', config);
    expect(resultB).toBeNull();
  });
});

// ─── RATE_LIMITS profiles ─────────────────────────────────────────────────────

describe('RATE_LIMITS', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns production api limits when SPOTIFY_DEV_MODE is not set', async () => {
    vi.stubEnv('SPOTIFY_DEV_MODE', '');
    const { RATE_LIMITS } = await import('@/lib/rate-limit');
    expect(RATE_LIMITS.api).toEqual({ maxTokens: 60, refillRate: 1 });
  });

  it('returns dev mode api limits when SPOTIFY_DEV_MODE is true', async () => {
    vi.stubEnv('SPOTIFY_DEV_MODE', 'true');
    const { RATE_LIMITS } = await import('@/lib/rate-limit');
    expect(RATE_LIMITS.api).toEqual({ maxTokens: 20, refillRate: 0.33 });
  });
});
