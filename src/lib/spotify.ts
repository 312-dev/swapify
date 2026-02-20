import { db } from '@/db';
import { circleMembers } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { encrypt, decrypt } from '@/lib/crypto';
import type {
  SpotifyTokenResponse,
  SpotifyUser,
  SpotifyTrack,
  SpotifyPlaylist,
  SpotifyRecentlyPlayedItem,
  SpotifySearchResult,
  SpotifyPlaylistItem,
  SpotifyUserPlaylistItem,
} from '@/types/spotify';

import { trackSpotifyApiCall, waitForBudget, spotifyConfig } from '@/lib/spotify-config';
import { logger } from '@/lib/logger';

const SPOTIFY_API = 'https://api.spotify.com/v1';
const SPOTIFY_ACCOUNTS = 'https://accounts.spotify.com';

// ─── Token Management ────────────────────────────────────────────────────────

/** Thrown when a refresh token is permanently invalid (revoked, already rotated, etc.) */
export class TokenInvalidError extends Error {
  constructor(
    public userId: string,
    public circleId: string,
    message: string
  ) {
    super(message);
    this.name = 'TokenInvalidError';
  }
}

/** Thrown when Spotify returns 429 and all retries are exhausted. */
export class SpotifyRateLimitError extends Error {
  constructor(
    public path: string,
    public retryAfterSeconds: number
  ) {
    super(`Spotify rate limit on ${path} — retry after ${retryAfterSeconds}s`);
    this.name = 'SpotifyRateLimitError';
  }
}

// Per-user-per-circle mutex: dedup concurrent refresh attempts so only one hits Spotify
const inflightRefreshes = new Map<string, Promise<string>>();

export async function refreshAccessToken(userId: string, circleId: string): Promise<string> {
  // If there's already an in-flight refresh for this user+circle, reuse it
  const key = `${userId}:${circleId}`;
  const existing = inflightRefreshes.get(key);
  if (existing) return existing;

  const promise = _doRefresh(userId, circleId);
  inflightRefreshes.set(key, promise);
  try {
    return await promise;
  } finally {
    inflightRefreshes.delete(key);
  }
}

async function _doRefresh(userId: string, circleId: string): Promise<string> {
  const member = await db.query.circleMembers.findFirst({
    where: and(eq(circleMembers.userId, userId), eq(circleMembers.circleId, circleId)),
    with: { circle: true },
  });

  if (!member) throw new Error(`Circle member not found for user ${userId} in circle ${circleId}`);

  // Member's refresh token was previously invalidated — skip
  if (!member.refreshToken) {
    throw new TokenInvalidError(
      userId,
      circleId,
      `User ${userId} in circle ${circleId} has no refresh token (needs re-login)`
    );
  }

  // Decrypt the refresh token before using it
  const refreshToken = decrypt(member.refreshToken);

  const now = Math.floor(Date.now() / 1000);
  // If token has > 5 minutes remaining, return existing (decrypt before returning)
  if (member.tokenExpiresAt - now > 300) {
    return decrypt(member.accessToken);
  }

  const res = await fetch(`${SPOTIFY_ACCOUNTS}/api/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: member.circle.spotifyClientId,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    // invalid_grant = refresh token revoked or already rotated — not retryable
    if (res.status === 400 && err.includes('invalid_grant')) {
      throw new TokenInvalidError(
        userId,
        circleId,
        `Refresh token invalid for user ${userId} in circle ${circleId}`
      );
    }
    throw new Error(`Token refresh failed: ${res.status} ${err}`);
  }

  const data: SpotifyTokenResponse = await res.json();

  // CRITICAL: Spotify PKCE rotates refresh tokens — the old one may now be invalid.
  // If this DB update fails, the new refresh token is lost and the user is locked out.
  // Retry once before giving up, and still return the access token so the current request succeeds.
  const tokenPayload = {
    accessToken: encrypt(data.access_token),
    refreshToken: data.refresh_token ? encrypt(data.refresh_token) : member.refreshToken,
    tokenExpiresAt: Math.floor(Date.now() / 1000) + data.expires_in,
  };

  try {
    await db
      .update(circleMembers)
      .set(tokenPayload)
      .where(and(eq(circleMembers.userId, userId), eq(circleMembers.circleId, circleId)));
  } catch (dbError) {
    logger.error(
      { error: dbError, userId, circleId },
      '[Swapify] CRITICAL: Failed to save rotated refresh token — retrying once'
    );
    try {
      await db
        .update(circleMembers)
        .set(tokenPayload)
        .where(and(eq(circleMembers.userId, userId), eq(circleMembers.circleId, circleId)));
    } catch (retryError) {
      // Token rotation succeeded at Spotify but we couldn't persist it.
      // The access token still works for ~1 hour; log so we can investigate.
      logger.error(
        { error: retryError, userId, circleId },
        '[Swapify] CRITICAL: Retry also failed — rotated refresh token lost. User will need to re-auth when access token expires.'
      );
    }
  }

  return data.access_token;
}

// ─── Rate Limit State ───────────────────────────────────────────────────────

let rateLimitedUntil = 0;

/** Returns true if the app is currently rate-limited by Spotify. */
export function isRateLimited(): boolean {
  return Date.now() < rateLimitedUntil;
}

/** Returns ms remaining until rate limit expires, or 0 if not limited. */
export function rateLimitRemainingMs(): number {
  return Math.max(0, rateLimitedUntil - Date.now());
}

// ─── API Call Log (rolling window for debugging rate limits) ─────────────────

const MAX_CALL_LOG = 50;
const apiCallLog: {
  ts: number;
  method: string;
  path: string;
  status: number;
  durationMs: number;
}[] = [];

const isLocalDev = !process.env.DATABASE_URL;
let fsModule: typeof import('fs') | null = null;
if (isLocalDev) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    fsModule = require('fs');
  } catch {
    // noop — fs unavailable in edge runtime
  }
}

function logApiCall(method: string, path: string, status: number, durationMs: number) {
  apiCallLog.push({ ts: Date.now(), method, path, status, durationMs });
  if (apiCallLog.length > MAX_CALL_LOG) apiCallLog.shift();

  let emoji = '✓';
  if (status === 429) emoji = '🚫';
  else if (status >= 400) emoji = '⚠️';
  logger.info(`[Spotify API] ${emoji} ${method} ${path} → ${status} (${durationMs}ms)`);

  // In local dev, append to spotify-requests.log
  if (fsModule) {
    const line =
      JSON.stringify({
        time: new Date().toISOString(),
        method,
        path,
        status,
        durationMs,
      }) + '\n';
    fsModule.appendFile('spotify-requests.log', line, () => {});
  }
}

function dumpRecentCalls() {
  const now = Date.now();
  const last30s = apiCallLog.filter((c) => now - c.ts < 30_000);
  const last60s = apiCallLog.filter((c) => now - c.ts < 60_000);
  logger.warn(
    {
      last30s: last30s.length,
      last60s: last60s.length,
      recentCalls: last60s.map((c) => ({
        ago: `${((now - c.ts) / 1000).toFixed(1)}s`,
        call: `${c.method} ${c.path} → ${c.status}`,
      })),
    },
    '[Spotify API] 429 hit — dumping recent call history'
  );
}

// ─── Core Fetch Wrapper ──────────────────────────────────────────────────────

async function spotifyFetch(
  userId: string,
  circleId: string,
  path: string,
  options: RequestInit = {},
  retries = 3
): Promise<Response> {
  const method = (options.method || 'GET').toUpperCase();

  // Respect app-level rate limit before making a request
  const waitMs = rateLimitRemainingMs();
  if (waitMs > 0) {
    logger.warn(
      `[Spotify API] Rate limited, waiting ${Math.round(waitMs / 1000)}s before ${method} ${path}`
    );
    await new Promise((r) => setTimeout(r, waitMs));
  }

  // Respect global API call budget (dev mode has much lower budget)
  await waitForBudget();

  const token = await refreshAccessToken(userId, circleId);

  trackSpotifyApiCall();
  const start = Date.now();
  const res = await fetch(`${SPOTIFY_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const durationMs = Date.now() - start;

  logApiCall(method, path, res.status, durationMs);

  if (res.status === 429) {
    const rawRetryAfter = res.headers.get('Retry-After') || '1';
    const retryAfter = Math.min(Number.parseInt(rawRetryAfter, 10) || 1, 60);
    logger.warn(
      `[Spotify API] 429 on ${path} — Retry-After: ${rawRetryAfter}s (capped to ${retryAfter}s)`
    );
    dumpRecentCalls();
    // Set app-level cooldown so other callers also back off
    rateLimitedUntil = Date.now() + retryAfter * 1000;
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      return spotifyFetch(userId, circleId, path, options, retries - 1);
    }
    throw new SpotifyRateLimitError(path, retryAfter);
  }

  if (res.status === 401 && retries > 0) {
    // Force refresh and retry — but if the token is permanently invalid, bail
    await db
      .update(circleMembers)
      .set({ tokenExpiresAt: 0 })
      .where(and(eq(circleMembers.userId, userId), eq(circleMembers.circleId, circleId)));
    return spotifyFetch(userId, circleId, path, options, retries - 1);
  }

  return res;
}

// ─── User ────────────────────────────────────────────────────────────────────

export async function getSpotifyProfile(accessToken: string): Promise<SpotifyUser> {
  const res = await fetch(`${SPOTIFY_API}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Failed to get profile: ${res.status}`);
  return res.json();
}

// ─── Playlists ───────────────────────────────────────────────────────────────

export async function createPlaylist(
  userId: string,
  circleId: string,
  name: string,
  description?: string,
  options?: { collaborative?: boolean }
): Promise<SpotifyPlaylist> {
  const collaborative = options?.collaborative ?? true;
  const res = await spotifyFetch(userId, circleId, `/me/playlists`, {
    method: 'POST',
    body: JSON.stringify({
      name,
      description: description || '',
      public: false,
      collaborative,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create playlist: ${res.status} ${err}`);
  }
  return res.json();
}

export async function updatePlaylistDetails(
  userId: string,
  circleId: string,
  playlistId: string,
  details: { name?: string; description?: string; collaborative?: boolean; public?: boolean }
): Promise<void> {
  const res = await spotifyFetch(userId, circleId, `/playlists/${playlistId}`, {
    method: 'PUT',
    body: JSON.stringify(details),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to update playlist: ${res.status} ${err}`);
  }
}

export async function uploadPlaylistImage(
  userId: string,
  circleId: string,
  playlistId: string,
  base64Jpeg: string
): Promise<void> {
  // Image upload has its own custom rate limit on Spotify's side.
  // We still track it against our global budget and respect rate limits.
  await waitForBudget();

  const token = await refreshAccessToken(userId, circleId);

  trackSpotifyApiCall();
  const res = await fetch(`${SPOTIFY_API}/playlists/${playlistId}/images`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'image/jpeg',
    },
    body: base64Jpeg,
  });

  if (res.status === 429) {
    const rawRetryAfter = res.headers.get('Retry-After') || '5';
    const retryAfter = Math.min(Number.parseInt(rawRetryAfter, 10) || 5, 60);
    console.warn(
      `[spotifyFetch] 429 on image upload — Retry-After: ${rawRetryAfter} (capped to ${retryAfter}s)`
    );
    rateLimitedUntil = Date.now() + retryAfter * 1000;
    throw new Error(`Playlist image upload rate-limited, retry after ${retryAfter}s`);
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to upload playlist image: ${res.status} ${err}`);
  }
}

export async function followPlaylist(
  userId: string,
  circleId: string,
  playlistId: string
): Promise<void> {
  const res = await spotifyFetch(userId, circleId, `/playlists/${playlistId}/followers`, {
    method: 'PUT',
    body: JSON.stringify({ public: false }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to follow playlist: ${res.status} ${err}`);
  }
}

export async function checkFollowPlaylist(
  userId: string,
  circleId: string,
  spotifyPlaylistId: string,
  spotifyUserId: string
): Promise<boolean> {
  const res = await spotifyFetch(
    userId,
    circleId,
    `/playlists/${spotifyPlaylistId}/followers/contains?ids=${spotifyUserId}`
  );
  if (!res.ok) {
    throw new Error(`Failed to check playlist follow: ${res.status}`);
  }
  const data: boolean[] = await res.json();
  return data[0] ?? false;
}

export async function getPlaylistDetails(
  userId: string,
  circleId: string,
  playlistId: string
): Promise<{
  name: string;
  description: string | null;
  imageUrl: string | null;
  trackCount: number;
  collaborative: boolean;
  isPublic: boolean;
}> {
  const res = await spotifyFetch(
    userId,
    circleId,
    `/playlists/${playlistId}?fields=name,description,images,items.total,collaborative,public`
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to get playlist details: ${res.status} ${err}`);
  }
  const data: {
    name: string;
    description: string | null;
    images: Array<{ url: string }>;
    items: { total: number };
    collaborative: boolean;
    public: boolean;
  } = await res.json();
  return {
    name: data.name,
    description: data.description || null,
    imageUrl: data.images?.[0]?.url || null,
    trackCount: data.items?.total ?? 0,
    collaborative: data.collaborative,
    isPublic: data.public,
  };
}

export async function getPlaylistItems(
  userId: string,
  circleId: string,
  playlistId: string
): Promise<SpotifyPlaylistItem[]> {
  const allItems: SpotifyPlaylistItem[] = [];
  let url = `/playlists/${playlistId}/items?limit=50`;

  while (url) {
    const res = await spotifyFetch(userId, circleId, url);
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to get playlist items: ${res.status} ${err}`);
    }
    const data: { items: SpotifyPlaylistItem[]; next: string | null } = await res.json();
    allItems.push(...data.items.filter((i) => i.item));
    // next is a full URL, extract the path
    if (data.next) {
      url = data.next.replace('https://api.spotify.com/v1', '');
    } else {
      url = '';
    }
  }

  return allItems;
}

// ─── User's Playlists ───────────────────────────────────────────────────────

export async function getUserPlaylists(
  userId: string,
  circleId: string
): Promise<SpotifyUserPlaylistItem[]> {
  const allPlaylists: SpotifyUserPlaylistItem[] = [];
  let url = '/me/playlists?limit=50';

  while (url) {
    const res = await spotifyFetch(userId, circleId, url);
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to get user playlists: ${res.status} ${err}`);
    }
    const data: { items: SpotifyUserPlaylistItem[]; next: string | null } = await res.json();
    allPlaylists.push(...data.items);
    if (data.next) {
      url = data.next.replace('https://api.spotify.com/v1', '');
    } else {
      url = '';
    }
  }

  return allPlaylists;
}

// ─── Playlist Items ──────────────────────────────────────────────────────────

export async function addItemsToPlaylist(
  userId: string,
  circleId: string,
  playlistId: string,
  uris: string[]
): Promise<{ snapshot_id: string }> {
  const res = await spotifyFetch(userId, circleId, `/playlists/${playlistId}/items`, {
    method: 'POST',
    body: JSON.stringify({ uris }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to add items: ${res.status} ${err}`);
  }
  return res.json();
}

export async function removeItemsFromPlaylist(
  userId: string,
  circleId: string,
  playlistId: string,
  uris: string[]
): Promise<{ snapshot_id: string }> {
  const res = await spotifyFetch(userId, circleId, `/playlists/${playlistId}/items`, {
    method: 'DELETE',
    body: JSON.stringify({
      items: uris.map((uri) => ({ uri })),
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to remove items: ${res.status} ${err}`);
  }
  return res.json();
}

// ─── Recently Played ─────────────────────────────────────────────────────────

export async function getRecentlyPlayed(
  userId: string,
  circleId: string,
  after?: number
): Promise<SpotifyRecentlyPlayedItem[]> {
  const params = new URLSearchParams({ limit: '50' });
  if (after) params.set('after', after.toString());

  const res = await spotifyFetch(userId, circleId, `/me/player/recently-played?${params}`);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to get recently played: ${res.status} ${err}`);
  }

  const data: { items: SpotifyRecentlyPlayedItem[] } = await res.json();
  return data.items;
}

// ─── Search ──────────────────────────────────────────────────────────────────

export async function searchTracks(
  userId: string,
  circleId: string,
  query: string,
  limit = spotifyConfig.searchLimit
): Promise<SpotifyTrack[]> {
  const params = new URLSearchParams({
    q: query,
    type: 'track',
    limit: limit.toString(),
  });

  const res = await spotifyFetch(userId, circleId, `/search?${params}`);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to search: ${res.status} ${err}`);
  }

  const data: SpotifySearchResult = await res.json();
  return data.tracks.items;
}

// ─── Current Playback ────────────────────────────────────────────────────────

export async function getCurrentPlayback(
  userId: string,
  circleId: string
): Promise<{ item?: SpotifyTrack; progress_ms?: number; is_playing?: boolean } | null> {
  const res = await spotifyFetch(userId, circleId, '/me/player/currently-playing');
  if (res.status === 204) return null;
  if (!res.ok) return null;
  return res.json();
}

// ─── Playback Control ───────────────────────────────────────────────────────

export async function startPlayback(
  userId: string,
  circleId: string,
  options: { contextUri?: string; trackUri: string }
): Promise<Response> {
  const body = options.contextUri
    ? { context_uri: options.contextUri, offset: { uri: options.trackUri } }
    : { uris: [options.trackUri] };

  return spotifyFetch(userId, circleId, '/me/player/play', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

// ─── User Library ───────────────────────────────────────────────────────────

export async function checkSavedTracks(
  userId: string,
  circleId: string,
  trackIds: string[]
): Promise<boolean[]> {
  const uris = trackIds.map((id) => `spotify:track:${id}`);
  const res = await spotifyFetch(userId, circleId, `/me/library/contains?uris=${uris.join(',')}`);
  if (!res.ok) {
    throw new Error(`Failed to check saved tracks: ${res.status}`);
  }
  return res.json();
}

export async function saveTracks(
  userId: string,
  circleId: string,
  trackIds: string[]
): Promise<void> {
  const uris = trackIds.map((id) => `spotify:track:${id}`);
  const res = await spotifyFetch(userId, circleId, '/me/library', {
    method: 'PUT',
    body: JSON.stringify({ uris }),
  });
  if (!res.ok) {
    throw new Error(`Failed to save tracks: ${res.status}`);
  }
}

export async function removeSavedTracks(
  userId: string,
  circleId: string,
  trackIds: string[]
): Promise<void> {
  const uris = trackIds.map((id) => `spotify:track:${id}`);
  const res = await spotifyFetch(userId, circleId, '/me/library', {
    method: 'DELETE',
    body: JSON.stringify({ uris }),
  });
  if (!res.ok) {
    throw new Error(`Failed to remove tracks: ${res.status}`);
  }
}

// ─── Playlist Reorder ───────────────────────────────────────────────────────

export async function reorderPlaylistTracks(
  userId: string,
  circleId: string,
  playlistId: string,
  uris: string[]
): Promise<{ snapshot_id: string }> {
  const res = await spotifyFetch(userId, circleId, `/playlists/${playlistId}/items`, {
    method: 'PUT',
    body: JSON.stringify({ uris }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to reorder playlist: ${res.status} ${err}`);
  }
  return res.json();
}

// ─── Audio Features ──────────────────────────────────────────────────────────

export async function getAudioFeatures(
  userId: string,
  circleId: string,
  trackIds: string[]
): Promise<Record<string, number>> {
  const energyMap: Record<string, number> = {};
  // Spotify supports up to 100 IDs per request
  for (let i = 0; i < trackIds.length; i += 100) {
    const batch = trackIds.slice(i, i + 100);
    const res = await spotifyFetch(userId, circleId, `/audio-features?ids=${batch.join(',')}`);
    if (!res.ok) {
      logger.warn({ status: res.status }, 'Failed to fetch audio features batch');
      continue;
    }
    const data = await res.json();
    for (const feature of data.audio_features ?? []) {
      if (feature?.id && typeof feature.energy === 'number') {
        energyMap[feature.id] = feature.energy;
      }
    }
  }
  return energyMap;
}
