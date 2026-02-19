import { NextResponse } from 'next/server';
import { isSpotifyDevMode } from '@/lib/spotify-config';

interface RateLimitEntry {
  tokens: number;
  lastRefill: number;
}

interface RateLimitConfig {
  /** Max tokens (requests) in the bucket */
  maxTokens: number;
  /** Tokens added per second */
  refillRate: number;
}

const buckets = new Map<string, RateLimitEntry>();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of buckets) {
    if (now - entry.lastRefill > 600_000) {
      buckets.delete(key);
    }
  }
}, 300_000);

/**
 * Check rate limit for a given key. Returns null if allowed, or a NextResponse 429 if blocked.
 */
export function checkRateLimit(key: string, config: RateLimitConfig): NextResponse | null {
  const now = Date.now();
  let entry = buckets.get(key);

  if (!entry) {
    entry = { tokens: config.maxTokens - 1, lastRefill: now };
    buckets.set(key, entry);
    return null;
  }

  // Refill tokens based on elapsed time
  const elapsed = (now - entry.lastRefill) / 1000;
  entry.tokens = Math.min(config.maxTokens, entry.tokens + elapsed * config.refillRate);
  entry.lastRefill = now;

  if (entry.tokens < 1) {
    const retryAfter = Math.ceil((1 - entry.tokens) / config.refillRate);
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': retryAfter.toString() },
      }
    );
  }

  entry.tokens -= 1;
  return null;
}

// Pre-configured rate limit profiles
// Dev mode uses stricter limits to stay within Spotify's lower API budget
function devMode() {
  return isSpotifyDevMode();
}

export const RATE_LIMITS = {
  /** General API: 60 req/min (dev: 20 req/min) per user */
  get api(): RateLimitConfig {
    return devMode() ? { maxTokens: 20, refillRate: 0.33 } : { maxTokens: 60, refillRate: 1 };
  },
  /** Search: 30 req/min (dev: 10 req/min) per user */
  get search(): RateLimitConfig {
    return devMode() ? { maxTokens: 10, refillRate: 0.17 } : { maxTokens: 30, refillRate: 0.5 };
  },
  /** Mutations (create playlist, add track): 20 req/min (dev: 8 req/min) per user */
  get mutation(): RateLimitConfig {
    return devMode() ? { maxTokens: 8, refillRate: 0.13 } : { maxTokens: 20, refillRate: 0.33 };
  },
  /** Email invites: 10 per hour per user (unchanged in dev mode) */
  invite: { maxTokens: 10, refillRate: 10 / 3600 } as RateLimitConfig,
  /** Unauthenticated endpoints: 20 req/min per IP */
  public: { maxTokens: 20, refillRate: 0.33 } as RateLimitConfig,
};
