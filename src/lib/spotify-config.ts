/**
 * Spotify API configuration that adapts to dev mode vs production.
 *
 * Dev mode (SPOTIFY_DEV_MODE=true):
 *   - Max 5 authenticated users (Spotify's dev mode limit)
 *   - Conservative API call budget (~50 calls/30s window)
 *   - Longer poll intervals, reduced background operation frequency
 *   - Search results capped at 5 (Feb 2026 dev mode limit)
 *
 * Production (SPOTIFY_DEV_MODE unset or false):
 *   - No user cap (extended quota mode)
 *   - Higher API call budget (~300 calls/30s window)
 *   - Normal poll intervals and background operations
 *   - Search results up to 10
 */

import { logger } from '@/lib/logger';

export function isSpotifyDevMode(): boolean {
  return process.env.SPOTIFY_DEV_MODE === 'true';
}

export const spotifyConfig = {
  /** Whether Spotify dev mode restrictions are active */
  get devMode() {
    return isSpotifyDevMode();
  },

  /** Max authenticated users allowed (Spotify dev mode = 5) */
  get maxUsers() {
    return isSpotifyDevMode() ? 5 : Infinity;
  },

  /** Max search results per query (Feb 2026: dev mode max = 10, default = 5) */
  get searchLimit() {
    return isSpotifyDevMode() ? 5 : 10;
  },

  /** Poll interval in ms (dev mode uses longer interval to conserve budget) */
  get pollIntervalMs() {
    if (process.env.POLL_INTERVAL_MS) {
      return Number(process.env.POLL_INTERVAL_MS);
    }
    return isSpotifyDevMode() ? 60_000 : 30_000;
  },

  /**
   * Max Spotify API calls allowed per rolling 30-second window.
   * Dev mode: very conservative (Spotify doesn't publish exact numbers,
   * but community reports suggest ~100-180 for dev apps; we stay well under).
   * Production: higher budget for extended quota apps.
   */
  get apiCallBudget() {
    return isSpotifyDevMode() ? 50 : 300;
  },

  /** How often to run saved-tracks auto-like check (in poll cycles) */
  get savedCheckEveryNCycles() {
    return isSpotifyDevMode() ? 10 : 4;
  },

  /** How often to run playlist audit (in poll cycles) */
  get auditEveryNCycles() {
    return isSpotifyDevMode() ? 6 : 2;
  },

  /** How often to sync liked playlists (in poll cycles) */
  get likedSyncEveryNCycles() {
    return isSpotifyDevMode() ? 10 : 4;
  },

  /** How often to run token keepalive sweep (in poll cycles).
   *  Dev mode: every 60 cycles (= ~60 min at 60s interval) — very conservative
   *  to avoid hitting undocumented accounts.spotify.com rate limits.
   *  Production: every 20 cycles (= ~10 min at 30s interval). */
  get tokenKeepaliveEveryNCycles() {
    return isSpotifyDevMode() ? 60 : 20;
  },
  /**
   * Minimum interval between Spotify description updates for vibe sync.
   * Dev mode: 10 minutes (conserve budget). Production: 5 minutes.
   */
  get vibeDescSyncMinIntervalMs() {
    return isSpotifyDevMode() ? 10 * 60_000 : 5 * 60_000;
  },
} as const;

// ─── Global API Call Budget Tracker ─────────────────────────────────────────

const WINDOW_MS = 30_000;
const callTimestamps: number[] = [];

function pruneOldCalls(): void {
  const cutoff = Date.now() - WINDOW_MS;
  while (callTimestamps.length > 0 && callTimestamps[0]! < cutoff) {
    callTimestamps.shift();
  }
}

/** Record that a Spotify API call was just made. */
export function trackSpotifyApiCall(): void {
  callTimestamps.push(Date.now());
  pruneOldCalls();
}

/** Get number of Spotify API calls in the current 30-second window. */
export function getCallsInWindow(): number {
  pruneOldCalls();
  return callTimestamps.length;
}

/** Check if we're at or over our API call budget. */
export function isOverBudget(): boolean {
  return getCallsInWindow() >= spotifyConfig.apiCallBudget;
}

/** Check if we're approaching the budget (80%+ used). */
export function isApproachingBudget(): boolean {
  return getCallsInWindow() >= spotifyConfig.apiCallBudget * 0.8;
}

/**
 * Wait until we have budget available, or throw if we can't get it
 * within a reasonable time. Used by spotifyFetch before making calls.
 */
export async function waitForBudget(maxWaitMs = 10_000): Promise<void> {
  const start = Date.now();
  while (isOverBudget()) {
    if (Date.now() - start > maxWaitMs) {
      logger.error(
        `[Spotify] API call budget exhausted (${getCallsInWindow()}/${spotifyConfig.apiCallBudget} in 30s window)`
      );
      throw new Error('Spotify API call budget exceeded — try again shortly');
    }
    // Wait a bit for old calls to age out of the window
    await new Promise((r) => setTimeout(r, 1_000));
  }

  if (isApproachingBudget()) {
    logger.warn(
      `[Spotify] Approaching API budget: ${getCallsInWindow()}/${spotifyConfig.apiCallBudget} calls in 30s window`
    );
  }
}
