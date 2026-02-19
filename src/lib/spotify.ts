import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { encrypt, decrypt } from '@/lib/crypto';
import type {
  SpotifyTokenResponse,
  SpotifyUser,
  SpotifyTrack,
  SpotifyPlaylist,
  SpotifyRecentlyPlayedItem,
  SpotifySearchResult,
  SpotifyPlaylistItem,
} from '@/types/spotify';

import { trackSpotifyApiCall, waitForBudget, spotifyConfig } from '@/lib/spotify-config';

const SPOTIFY_API = 'https://api.spotify.com/v1';
const SPOTIFY_ACCOUNTS = 'https://accounts.spotify.com';

// ─── Token Management ────────────────────────────────────────────────────────

/** Thrown when a refresh token is permanently invalid (revoked, already rotated, etc.) */
export class TokenInvalidError extends Error {
  constructor(
    public userId: string,
    message: string
  ) {
    super(message);
    this.name = 'TokenInvalidError';
  }
}

// Per-user mutex: dedup concurrent refresh attempts so only one hits Spotify
const inflightRefreshes = new Map<string, Promise<string>>();

export async function refreshAccessToken(userId: string): Promise<string> {
  // If there's already an in-flight refresh for this user, reuse it
  const existing = inflightRefreshes.get(userId);
  if (existing) return existing;

  const promise = _doRefresh(userId);
  inflightRefreshes.set(userId, promise);
  try {
    return await promise;
  } finally {
    inflightRefreshes.delete(userId);
  }
}

async function _doRefresh(userId: string): Promise<string> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) throw new Error(`User ${userId} not found`);

  // User's refresh token was previously invalidated — skip
  if (!user.refreshToken) {
    throw new TokenInvalidError(userId, `User ${userId} has no refresh token (needs re-login)`);
  }

  // Decrypt the refresh token before using it
  const refreshToken = decrypt(user.refreshToken);

  const now = Math.floor(Date.now() / 1000);
  // If token has > 5 minutes remaining, return existing (decrypt before returning)
  if (user.tokenExpiresAt - now > 300) {
    return decrypt(user.accessToken);
  }

  const res = await fetch(`${SPOTIFY_ACCOUNTS}/api/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: user.spotifyClientId || process.env.SPOTIFY_CLIENT_ID!,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    // invalid_grant = refresh token revoked or already rotated — not retryable
    if (res.status === 400 && err.includes('invalid_grant')) {
      throw new TokenInvalidError(userId, `Refresh token invalid for user ${userId}`);
    }
    throw new Error(`Token refresh failed: ${res.status} ${err}`);
  }

  const data: SpotifyTokenResponse = await res.json();

  await db
    .update(users)
    .set({
      accessToken: encrypt(data.access_token),
      refreshToken: data.refresh_token ? encrypt(data.refresh_token) : user.refreshToken,
      tokenExpiresAt: Math.floor(Date.now() / 1000) + data.expires_in,
    })
    .where(eq(users.id, userId));

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

// ─── Core Fetch Wrapper ──────────────────────────────────────────────────────

async function spotifyFetch(
  userId: string,
  path: string,
  options: RequestInit = {},
  retries = 3
): Promise<Response> {
  // Respect app-level rate limit before making a request
  const waitMs = rateLimitRemainingMs();
  if (waitMs > 0) {
    await new Promise((r) => setTimeout(r, waitMs));
  }

  // Respect global API call budget (dev mode has much lower budget)
  await waitForBudget();

  const token = await refreshAccessToken(userId);

  trackSpotifyApiCall();
  const res = await fetch(`${SPOTIFY_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('Retry-After') || '1', 10);
    // Set app-level cooldown so other callers also back off
    rateLimitedUntil = Date.now() + retryAfter * 1000;
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      return spotifyFetch(userId, path, options, retries - 1);
    }
  }

  if (res.status === 401 && retries > 0) {
    // Force refresh and retry — but if the token is permanently invalid, bail
    await db.update(users).set({ tokenExpiresAt: 0 }).where(eq(users.id, userId));
    return spotifyFetch(userId, path, options, retries - 1);
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
  name: string,
  description?: string,
  options?: { collaborative?: boolean }
): Promise<SpotifyPlaylist> {
  const collaborative = options?.collaborative ?? true;
  const res = await spotifyFetch(userId, `/me/playlists`, {
    method: 'POST',
    body: JSON.stringify({
      name,
      description: description || 'A Swapify collaborative playlist',
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
  playlistId: string,
  details: { name?: string; description?: string }
): Promise<void> {
  const res = await spotifyFetch(userId, `/playlists/${playlistId}`, {
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
  playlistId: string,
  base64Jpeg: string
): Promise<void> {
  // Image upload has its own custom rate limit on Spotify's side.
  // We still track it against our global budget and respect rate limits.
  await waitForBudget();

  const token = await refreshAccessToken(userId);

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
    const retryAfter = Number.parseInt(res.headers.get('Retry-After') || '5', 10);
    rateLimitedUntil = Date.now() + retryAfter * 1000;
    throw new Error(`Playlist image upload rate-limited, retry after ${retryAfter}s`);
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to upload playlist image: ${res.status} ${err}`);
  }
}

export async function followPlaylist(userId: string, playlistId: string): Promise<void> {
  const res = await spotifyFetch(userId, `/playlists/${playlistId}/followers`, {
    method: 'PUT',
    body: JSON.stringify({ public: false }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to follow playlist: ${res.status} ${err}`);
  }
}

export async function getPlaylistDetails(
  userId: string,
  playlistId: string
): Promise<{ name: string; description: string | null; imageUrl: string | null }> {
  const res = await spotifyFetch(userId, `/playlists/${playlistId}?fields=name,description,images`);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to get playlist details: ${res.status} ${err}`);
  }
  const data: { name: string; description: string | null; images: Array<{ url: string }> } =
    await res.json();
  return {
    name: data.name,
    description: data.description || null,
    imageUrl: data.images?.[0]?.url || null,
  };
}

export async function getPlaylistItems(
  userId: string,
  playlistId: string
): Promise<SpotifyPlaylistItem[]> {
  const allItems: SpotifyPlaylistItem[] = [];
  let url = `/playlists/${playlistId}/items?limit=50`;

  while (url) {
    const res = await spotifyFetch(userId, url);
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to get playlist items: ${res.status} ${err}`);
    }
    const data: { items: SpotifyPlaylistItem[]; next: string | null } = await res.json();
    allItems.push(...data.items.filter((i) => i.track));
    // next is a full URL, extract the path
    if (data.next) {
      url = data.next.replace('https://api.spotify.com/v1', '');
    } else {
      url = '';
    }
  }

  return allItems;
}

// ─── Playlist Items ──────────────────────────────────────────────────────────

export async function addItemsToPlaylist(
  userId: string,
  playlistId: string,
  uris: string[]
): Promise<{ snapshot_id: string }> {
  const res = await spotifyFetch(userId, `/playlists/${playlistId}/items`, {
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
  playlistId: string,
  uris: string[]
): Promise<{ snapshot_id: string }> {
  const res = await spotifyFetch(userId, `/playlists/${playlistId}/items`, {
    method: 'DELETE',
    body: JSON.stringify({
      tracks: uris.map((uri) => ({ uri })),
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
  after?: number
): Promise<SpotifyRecentlyPlayedItem[]> {
  const params = new URLSearchParams({ limit: '50' });
  if (after) params.set('after', after.toString());

  const res = await spotifyFetch(userId, `/me/player/recently-played?${params}`);
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
  query: string,
  limit = spotifyConfig.searchLimit
): Promise<SpotifyTrack[]> {
  const params = new URLSearchParams({
    q: query,
    type: 'track',
    limit: limit.toString(),
  });

  const res = await spotifyFetch(userId, `/search?${params}`);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to search: ${res.status} ${err}`);
  }

  const data: SpotifySearchResult = await res.json();
  return data.tracks.items;
}

// ─── Current Playback ────────────────────────────────────────────────────────

export async function getCurrentPlayback(
  userId: string
): Promise<{ item?: SpotifyTrack; progress_ms?: number; is_playing?: boolean } | null> {
  const res = await spotifyFetch(userId, '/me/player/currently-playing');
  if (res.status === 204) return null;
  if (!res.ok) return null;
  return res.json();
}

// ─── Playback Control ───────────────────────────────────────────────────────

export async function startPlayback(
  userId: string,
  options: { contextUri?: string; trackUri: string }
): Promise<Response> {
  const body = options.contextUri
    ? { context_uri: options.contextUri, offset: { uri: options.trackUri } }
    : { uris: [options.trackUri] };

  return spotifyFetch(userId, '/me/player/play', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

// ─── User Library ───────────────────────────────────────────────────────────

export async function checkSavedTracks(userId: string, trackIds: string[]): Promise<boolean[]> {
  const res = await spotifyFetch(userId, `/me/tracks/contains?ids=${trackIds.join(',')}`);
  if (!res.ok) {
    throw new Error(`Failed to check saved tracks: ${res.status}`);
  }
  return res.json();
}

export async function saveTracks(userId: string, trackIds: string[]): Promise<void> {
  const res = await spotifyFetch(userId, '/me/tracks', {
    method: 'PUT',
    body: JSON.stringify({ ids: trackIds }),
  });
  if (!res.ok) {
    throw new Error(`Failed to save tracks: ${res.status}`);
  }
}

export async function removeSavedTracks(userId: string, trackIds: string[]): Promise<void> {
  const res = await spotifyFetch(userId, '/me/tracks', {
    method: 'DELETE',
    body: JSON.stringify({ ids: trackIds }),
  });
  if (!res.ok) {
    throw new Error(`Failed to remove tracks: ${res.status}`);
  }
}

// ─── Playlist Reorder ───────────────────────────────────────────────────────

export async function reorderPlaylistTracks(
  userId: string,
  playlistId: string,
  uris: string[]
): Promise<{ snapshot_id: string }> {
  const res = await spotifyFetch(userId, `/playlists/${playlistId}/tracks`, {
    method: 'PUT',
    body: JSON.stringify({ uris }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to reorder playlist: ${res.status} ${err}`);
  }
  return res.json();
}
