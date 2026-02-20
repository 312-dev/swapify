import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/spotify-config', () => ({
  isSpotifyDevMode: vi.fn(() => false),
}));

vi.mock('next/server', () => ({
  NextResponse: {
    json(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
      return {
        body,
        status: init?.status ?? 200,
        headers: new Map(Object.entries(init?.headers ?? {})),
      };
    },
  },
}));

import { checkRateLimit, RATE_LIMITS } from './rate-limit';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('checkRateLimit', () => {
  it('allows the first request for a new key', () => {
    const result = checkRateLimit('first-request-key', { maxTokens: 5, refillRate: 1 });
    expect(result).toBeNull();
  });

  it('allows requests until tokens are exhausted', () => {
    const config = { maxTokens: 3, refillRate: 0 };
    const key = 'exhaust-key';

    // First request: creates bucket with maxTokens - 1 = 2 tokens remaining
    expect(checkRateLimit(key, config)).toBeNull();

    // Second request: 2 tokens -> 1 (no time elapsed, no refill, refillRate = 0)
    expect(checkRateLimit(key, config)).toBeNull();

    // Third request: 1 token -> 0
    expect(checkRateLimit(key, config)).toBeNull();

    // Fourth request: 0 tokens -> blocked
    const blocked = checkRateLimit(key, config);
    expect(blocked).not.toBeNull();
  });

  it('returns 429 status when rate limited', () => {
    const config = { maxTokens: 1, refillRate: 0 };
    const key = 'status-429-key';

    // First request uses the one token
    checkRateLimit(key, config);

    // Second request should be blocked
    const result = checkRateLimit(key, config);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(429);
    expect((result as any).body).toEqual({
      error: 'Too many requests. Please try again later.',
    });
  });

  it('includes Retry-After header in 429 response', () => {
    const config = { maxTokens: 1, refillRate: 0.5 };
    const key = 'retry-after-key';

    // Exhaust the token
    checkRateLimit(key, config);

    // Next request should be blocked with Retry-After
    const result = checkRateLimit(key, config);
    expect(result).not.toBeNull();
    expect(result!.headers.get('Retry-After')).toBeDefined();
    const retryAfter = parseInt(result!.headers.get('Retry-After')!, 10);
    expect(retryAfter).toBeGreaterThan(0);
  });

  it('refills tokens after time passes', () => {
    const config = { maxTokens: 2, refillRate: 1 }; // 1 token per second
    const key = 'refill-key';

    // First request: bucket starts with maxTokens - 1 = 1 token
    expect(checkRateLimit(key, config)).toBeNull();

    // Second request: 1 -> 0 tokens
    expect(checkRateLimit(key, config)).toBeNull();

    // Third request immediately: should be blocked (0 tokens, no time elapsed)
    expect(checkRateLimit(key, config)).not.toBeNull();

    // Advance time by 3 seconds (refills 3 tokens at 1/sec, capped at maxTokens=2)
    vi.advanceTimersByTime(3000);

    // Should now be allowed again after refill
    expect(checkRateLimit(key, config)).toBeNull();
  });

  it('uses independent buckets for different keys', () => {
    const config = { maxTokens: 1, refillRate: 0 };

    // Exhaust key A
    checkRateLimit('independent-a', config);
    const blockedA = checkRateLimit('independent-a', config);
    expect(blockedA).not.toBeNull();
    expect(blockedA!.status).toBe(429);

    // Key B should still be allowed
    const resultB = checkRateLimit('independent-b', config);
    expect(resultB).toBeNull();
  });
});

describe('RATE_LIMITS', () => {
  it('returns correct production values for api', () => {
    expect(RATE_LIMITS.api).toEqual({ maxTokens: 60, refillRate: 1 });
  });

  it('returns correct production values for search', () => {
    expect(RATE_LIMITS.search).toEqual({ maxTokens: 30, refillRate: 0.5 });
  });

  it('returns correct production values for mutation', () => {
    expect(RATE_LIMITS.mutation).toEqual({ maxTokens: 20, refillRate: 0.33 });
  });

  it('returns correct values for invite', () => {
    expect(RATE_LIMITS.invite.maxTokens).toBe(10);
    expect(RATE_LIMITS.invite.refillRate).toBeCloseTo(10 / 3600, 5);
  });

  it('returns correct values for public', () => {
    expect(RATE_LIMITS.public).toEqual({ maxTokens: 20, refillRate: 0.33 });
  });

  it('returns dev mode values when dev mode is enabled', async () => {
    const { isSpotifyDevMode } = await import('@/lib/spotify-config');
    vi.mocked(isSpotifyDevMode).mockReturnValue(true);

    expect(RATE_LIMITS.api).toEqual({ maxTokens: 20, refillRate: 0.33 });
    expect(RATE_LIMITS.search).toEqual({ maxTokens: 10, refillRate: 0.17 });
    expect(RATE_LIMITS.mutation).toEqual({ maxTokens: 8, refillRate: 0.13 });

    // Restore
    vi.mocked(isSpotifyDevMode).mockReturnValue(false);
  });
});
