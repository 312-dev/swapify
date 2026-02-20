import { describe, it, expect, vi } from 'vitest';

// Mock the logger since it depends on pino which may not be available in tests
vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// ─── isSpotifyDevMode ─────────────────────────────────────────────────────────

describe('isSpotifyDevMode', () => {
  it('returns false by default', async () => {
    vi.stubEnv('SPOTIFY_DEV_MODE', '');
    const { isSpotifyDevMode } = await import('@/lib/spotify-config');
    expect(isSpotifyDevMode()).toBe(false);
  });

  it('returns true when SPOTIFY_DEV_MODE is "true"', async () => {
    vi.stubEnv('SPOTIFY_DEV_MODE', 'true');
    const { isSpotifyDevMode } = await import('@/lib/spotify-config');
    expect(isSpotifyDevMode()).toBe(true);
  });
});

// ─── spotifyConfig ────────────────────────────────────────────────────────────

describe('spotifyConfig', () => {
  it('searchLimit is 10 in production mode', async () => {
    vi.stubEnv('SPOTIFY_DEV_MODE', '');
    const { spotifyConfig } = await import('@/lib/spotify-config');
    expect(spotifyConfig.searchLimit).toBe(10);
  });

  it('searchLimit is 5 in dev mode', async () => {
    vi.stubEnv('SPOTIFY_DEV_MODE', 'true');
    const { spotifyConfig } = await import('@/lib/spotify-config');
    expect(spotifyConfig.searchLimit).toBe(5);
  });

  it('pollIntervalMs is 30000 in production mode', async () => {
    vi.stubEnv('SPOTIFY_DEV_MODE', '');
    vi.stubEnv('POLL_INTERVAL_MS', '');
    const { spotifyConfig } = await import('@/lib/spotify-config');
    expect(spotifyConfig.pollIntervalMs).toBe(30_000);
  });

  it('pollIntervalMs is 60000 in dev mode', async () => {
    vi.stubEnv('SPOTIFY_DEV_MODE', 'true');
    vi.stubEnv('POLL_INTERVAL_MS', '');
    const { spotifyConfig } = await import('@/lib/spotify-config');
    expect(spotifyConfig.pollIntervalMs).toBe(60_000);
  });

  it('pollIntervalMs respects POLL_INTERVAL_MS override', async () => {
    vi.stubEnv('SPOTIFY_DEV_MODE', '');
    vi.stubEnv('POLL_INTERVAL_MS', '45000');
    const { spotifyConfig } = await import('@/lib/spotify-config');
    expect(spotifyConfig.pollIntervalMs).toBe(45_000);
  });

  it('apiCallBudget is 300 in production mode', async () => {
    vi.stubEnv('SPOTIFY_DEV_MODE', '');
    const { spotifyConfig } = await import('@/lib/spotify-config');
    expect(spotifyConfig.apiCallBudget).toBe(300);
  });

  it('apiCallBudget is 50 in dev mode', async () => {
    vi.stubEnv('SPOTIFY_DEV_MODE', 'true');
    const { spotifyConfig } = await import('@/lib/spotify-config');
    expect(spotifyConfig.apiCallBudget).toBe(50);
  });
});

// ─── API call budget tracker ──────────────────────────────────────────────────

describe('trackSpotifyApiCall / getCallsInWindow', () => {
  it('increments the call count', async () => {
    const { trackSpotifyApiCall, getCallsInWindow } = await import('@/lib/spotify-config');
    expect(getCallsInWindow()).toBe(0);

    trackSpotifyApiCall();
    trackSpotifyApiCall();
    trackSpotifyApiCall();

    expect(getCallsInWindow()).toBe(3);
  });
});

describe('isOverBudget', () => {
  it('returns true when calls reach the budget', async () => {
    // Use dev mode so budget is 50 (more practical to fill)
    vi.stubEnv('SPOTIFY_DEV_MODE', 'true');
    const { trackSpotifyApiCall, isOverBudget } = await import('@/lib/spotify-config');

    expect(isOverBudget()).toBe(false);

    // Fill up to the budget of 50
    for (let i = 0; i < 50; i++) {
      trackSpotifyApiCall();
    }

    expect(isOverBudget()).toBe(true);
  });
});

describe('isApproachingBudget', () => {
  it('returns true at 80% or more of the budget', async () => {
    vi.stubEnv('SPOTIFY_DEV_MODE', 'true');
    const { trackSpotifyApiCall, isApproachingBudget } = await import('@/lib/spotify-config');

    // Budget is 50, 80% = 40
    for (let i = 0; i < 39; i++) {
      trackSpotifyApiCall();
    }
    expect(isApproachingBudget()).toBe(false);

    // One more to hit 40 (80%)
    trackSpotifyApiCall();
    expect(isApproachingBudget()).toBe(true);
  });
});

// ─── waitForBudget ────────────────────────────────────────────────────────────

describe('waitForBudget', () => {
  it('resolves immediately when under budget', async () => {
    vi.stubEnv('SPOTIFY_DEV_MODE', '');
    const { waitForBudget } = await import('@/lib/spotify-config');
    // No calls tracked, well under budget — should resolve without delay
    await expect(waitForBudget()).resolves.toBeUndefined();
  });

  it('throws after maxWaitMs when over budget', async () => {
    vi.useFakeTimers();

    vi.stubEnv('SPOTIFY_DEV_MODE', 'true');
    const { trackSpotifyApiCall, waitForBudget } = await import('@/lib/spotify-config');

    // Fill budget (50 calls in dev mode)
    for (let i = 0; i < 50; i++) {
      trackSpotifyApiCall();
    }

    // Start waiting with a short maxWaitMs and immediately attach
    // a catch handler so the rejection is never "unhandled"
    let caught: Error | undefined;
    const promise = waitForBudget(3_000).catch((e: Error) => {
      caught = e;
    });

    // Advance timers past maxWaitMs -- the loop checks every 1s,
    // so advance in 1s increments to let each setTimeout resolve
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.advanceTimersByTimeAsync(1_000);

    await promise;

    expect(caught).toBeDefined();
    expect(caught!.message).toBe('Spotify API call budget exceeded — try again shortly');

    vi.useRealTimers();
  });
});
