import { describe, it, expect, vi, beforeAll, beforeEach, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { handlers, mockTrack } from '@/test/msw-handlers';

// ─── Mock Dependencies (hoisted before module-under-test import) ────────────

vi.mock('@/db', () => ({
  db: {
    query: {
      circleMembers: {
        findFirst: vi.fn(),
      },
    },
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(),
      })),
    })),
  },
}));

vi.mock('@/db/schema', () => ({
  circleMembers: {
    userId: 'user_id',
    circleId: 'circle_id',
    tokenExpiresAt: 'token_expires_at',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => args),
  and: vi.fn((...args: unknown[]) => args),
}));

vi.mock('@/lib/crypto', () => ({
  encrypt: vi.fn((s: string) => s),
  decrypt: vi.fn((s: string) => s),
}));

vi.mock('@/lib/spotify-config', () => ({
  trackSpotifyApiCall: vi.fn(),
  waitForBudget: vi.fn().mockResolvedValue(undefined),
  spotifyConfig: { searchLimit: 10 },
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// ─── MSW Server ─────────────────────────────────────────────────────────────

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ─── Import mocked DB + module under test ───────────────────────────────────

import { db } from '@/db';
import {
  refreshAccessToken,
  TokenInvalidError,
  getSpotifyProfile,
  createPlaylist,
  getPlaylistItems,
  addItemsToPlaylist,
  removeItemsFromPlaylist,
  searchTracks,
  getCurrentPlayback,
  getRecentlyPlayed,
  checkSavedTracks,
  startPlayback,
  reorderPlaylistTracks,
  getPlaylistDetails,
  followPlaylist,
} from '@/lib/spotify';

// ─── Helpers ────────────────────────────────────────────────────────────────

const SPOTIFY_API = 'https://api.spotify.com/v1';
const SPOTIFY_ACCOUNTS = 'https://accounts.spotify.com';

/**
 * Configure the mocked DB to return a circleMembers record.
 * Defaults to a valid, unexpired token (>5 min remaining).
 */
function mockDbMember(overrides: Record<string, unknown> = {}) {
  const member = {
    userId: 'user-1',
    circleId: 'circle-1',
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
    tokenExpiresAt: Math.floor(Date.now() / 1000) + 3600, // 1hr from now
    circle: { spotifyClientId: 'test-client-id' },
    ...overrides,
  };
  vi.mocked(db.query.circleMembers.findFirst).mockResolvedValue(member as never);
  return member;
}

beforeEach(() => {
  // Reset db.update chain for each test
  const whereChain = { where: vi.fn().mockResolvedValue(undefined) };
  const setChain = { set: vi.fn().mockReturnValue(whereChain) };
  vi.mocked(db.update).mockReturnValue(setChain as never);

  // Default: valid member with unexpired token
  mockDbMember();
});

// ─── Token Management ───────────────────────────────────────────────────────

describe('refreshAccessToken', () => {
  it('returns cached decrypted token when >5 min remaining (no Spotify fetch)', async () => {
    // Token expires in 1hr, well above the 5-min threshold
    mockDbMember({ tokenExpiresAt: Math.floor(Date.now() / 1000) + 3600 });

    // Override /api/token to fail so we can confirm it is NOT called
    server.use(
      http.post(`${SPOTIFY_ACCOUNTS}/api/token`, () => {
        throw new Error('Token endpoint should not be called for cached token');
      })
    );

    const token = await refreshAccessToken('user-1', 'circle-1');
    expect(token).toBe('test-access-token');
  });

  it('refreshes and returns new token when expired', async () => {
    // Token expired 10 minutes ago
    mockDbMember({ tokenExpiresAt: Math.floor(Date.now() / 1000) - 600 });

    const token = await refreshAccessToken('user-1', 'circle-1');
    expect(token).toBe('new-access-token');
  });

  it('deduplicates concurrent refresh calls', async () => {
    // Token expired so a real refresh is needed
    mockDbMember({ tokenExpiresAt: Math.floor(Date.now() / 1000) - 600 });
    // Reset call history so we only count calls from the concurrent invocations below
    vi.mocked(db.query.circleMembers.findFirst).mockClear();
    // Re-set the return value (mockClear wipes implementation)
    mockDbMember({ tokenExpiresAt: Math.floor(Date.now() / 1000) - 600 });

    // Record calls starting from here
    const callsBefore = vi.mocked(db.query.circleMembers.findFirst).mock.calls.length;

    // Fire two calls concurrently
    const [token1, token2] = await Promise.all([
      refreshAccessToken('user-1', 'circle-1'),
      refreshAccessToken('user-1', 'circle-1'),
    ]);

    const callsAfter = vi.mocked(db.query.circleMembers.findFirst).mock.calls.length;

    expect(token1).toBe('new-access-token');
    expect(token2).toBe('new-access-token');
    // The DB should only be queried once since the second call reuses the inflight promise
    expect(callsAfter - callsBefore).toBe(1);
  });

  it('throws TokenInvalidError on invalid_grant response', async () => {
    mockDbMember({ tokenExpiresAt: Math.floor(Date.now() / 1000) - 600 });

    server.use(
      http.post(`${SPOTIFY_ACCOUNTS}/api/token`, () => {
        return new HttpResponse(
          '{"error":"invalid_grant","error_description":"Refresh token revoked"}',
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      })
    );

    await expect(refreshAccessToken('user-1', 'circle-1')).rejects.toThrow(TokenInvalidError);
  });

  it('throws TokenInvalidError when refresh token is empty', async () => {
    mockDbMember({ refreshToken: '' });

    // Even though token is valid, empty refreshToken means the member
    // was previously invalidated. The code checks !member.refreshToken before checking expiry.
    // Actually, decrypt('') returns '' which is falsy, so the guard triggers.
    // But the code checks member.refreshToken (before decrypt), so we need it to be falsy.
    mockDbMember({ refreshToken: null, tokenExpiresAt: Math.floor(Date.now() / 1000) - 600 });

    await expect(refreshAccessToken('user-1', 'circle-1')).rejects.toThrow(TokenInvalidError);
  });
});

// ─── getSpotifyProfile ──────────────────────────────────────────────────────

describe('getSpotifyProfile', () => {
  it('returns parsed SpotifyUser from /me endpoint', async () => {
    const profile = await getSpotifyProfile('some-access-token');
    expect(profile).toEqual({
      id: 'user-1',
      display_name: 'Test User',
      images: [],
      external_urls: { spotify: 'https://open.spotify.com/user/user-1' },
    });
  });
});

// ─── createPlaylist ─────────────────────────────────────────────────────────

describe('createPlaylist', () => {
  it('sends correct body and returns SpotifyPlaylist', async () => {
    let capturedBody: Record<string, unknown> | null = null;
    server.use(
      http.post(`${SPOTIFY_API}/me/playlists`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          id: 'playlist-1',
          name: 'My Swaplist',
          collaborative: true,
          public: false,
          snapshot_id: 'snap-1',
          external_urls: { spotify: '' },
          owner: { id: 'user-1', display_name: 'Test', images: [], external_urls: { spotify: '' } },
        });
      })
    );

    const result = await createPlaylist('user-1', 'circle-1', 'My Swaplist', 'A cool playlist');
    expect(result.id).toBe('playlist-1');
    expect(result.name).toBe('My Swaplist');
    expect(capturedBody).toMatchObject({
      name: 'My Swaplist',
      description: 'A cool playlist',
      public: false,
      collaborative: true,
    });
  });

  it('throws on non-ok response', async () => {
    server.use(
      http.post(`${SPOTIFY_API}/me/playlists`, () => {
        return new HttpResponse('Internal Server Error', { status: 500 });
      })
    );

    await expect(createPlaylist('user-1', 'circle-1', 'Fail')).rejects.toThrow(
      /Failed to create playlist: 500/
    );
  });
});

// ─── getPlaylistItems ───────────────────────────────────────────────────────

describe('getPlaylistItems', () => {
  it('returns items from a single page', async () => {
    const items = await getPlaylistItems('user-1', 'circle-1', 'playlist-1');
    expect(items).toHaveLength(1);
    expect(items[0]!.item.id).toBe('track-1');
  });

  it('handles pagination by following next URLs', async () => {
    let callCount = 0;
    server.use(
      http.get(`${SPOTIFY_API}/playlists/:id/items`, ({ request }) => {
        callCount++;
        const url = new URL(request.url);
        if (!url.searchParams.has('page2')) {
          // First page: return a next URL
          return HttpResponse.json({
            items: [
              {
                added_at: new Date().toISOString(),
                added_by: { id: 'user-1', uri: '', external_urls: { spotify: '' } },
                item: { ...mockTrack, id: 'track-page1', name: 'Page 1 Track' },
              },
            ],
            next: `${SPOTIFY_API}/playlists/playlist-1/items?page2=true`,
          });
        }
        // Second page: no next
        return HttpResponse.json({
          items: [
            {
              added_at: new Date().toISOString(),
              added_by: { id: 'user-1', uri: '', external_urls: { spotify: '' } },
              item: { ...mockTrack, id: 'track-page2', name: 'Page 2 Track' },
            },
          ],
          next: null,
        });
      })
    );

    const items = await getPlaylistItems('user-1', 'circle-1', 'playlist-1');
    expect(items).toHaveLength(2);
    expect(items[0]!.item.id).toBe('track-page1');
    expect(items[1]!.item.id).toBe('track-page2');
    expect(callCount).toBe(2);
  });
});

// ─── addItemsToPlaylist ─────────────────────────────────────────────────────

describe('addItemsToPlaylist', () => {
  it('sends URIs and returns snapshot_id', async () => {
    let capturedBody: Record<string, unknown> | null = null;
    server.use(
      http.post(`${SPOTIFY_API}/playlists/:id/items`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ snapshot_id: 'snap-add' });
      })
    );

    const result = await addItemsToPlaylist('user-1', 'circle-1', 'playlist-1', [
      'spotify:track:a',
      'spotify:track:b',
    ]);
    expect(result.snapshot_id).toBe('snap-add');
    expect(capturedBody).toEqual({ uris: ['spotify:track:a', 'spotify:track:b'] });
  });
});

// ─── removeItemsFromPlaylist ────────────────────────────────────────────────

describe('removeItemsFromPlaylist', () => {
  it('sends tracks array with uri objects', async () => {
    let capturedBody: Record<string, unknown> | null = null;
    server.use(
      http.delete(`${SPOTIFY_API}/playlists/:id/items`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ snapshot_id: 'snap-del' });
      })
    );

    const result = await removeItemsFromPlaylist('user-1', 'circle-1', 'playlist-1', [
      'spotify:track:x',
      'spotify:track:y',
    ]);
    expect(result.snapshot_id).toBe('snap-del');
    expect(capturedBody).toEqual({
      items: [{ uri: 'spotify:track:x' }, { uri: 'spotify:track:y' }],
    });
  });
});

// ─── searchTracks ───────────────────────────────────────────────────────────

describe('searchTracks', () => {
  it('returns track items from search result', async () => {
    const tracks = await searchTracks('user-1', 'circle-1', 'mock track');
    expect(tracks).toHaveLength(1);
    expect(tracks[0]!.id).toBe('track-1');
    expect(tracks[0]!.name).toBe('Mock Track');
  });
});

// ─── getCurrentPlayback ─────────────────────────────────────────────────────

describe('getCurrentPlayback', () => {
  it('returns playback data when playing', async () => {
    const playback = await getCurrentPlayback('user-1', 'circle-1');
    expect(playback).not.toBeNull();
    expect(playback!.is_playing).toBe(true);
    expect(playback!.item?.id).toBe('track-1');
    expect(playback!.progress_ms).toBe(50000);
  });

  it('returns null on 204 (no content / nothing playing)', async () => {
    server.use(
      http.get(`${SPOTIFY_API}/me/player/currently-playing`, () => {
        return new HttpResponse(null, { status: 204 });
      })
    );

    const playback = await getCurrentPlayback('user-1', 'circle-1');
    expect(playback).toBeNull();
  });
});

// ─── getRecentlyPlayed ──────────────────────────────────────────────────────

describe('getRecentlyPlayed', () => {
  it('returns recently played items', async () => {
    const items = await getRecentlyPlayed('user-1', 'circle-1');
    expect(items).toHaveLength(1);
    expect(items[0]!.track.id).toBe('track-1');
    expect(items[0]!.played_at).toBeDefined();
  });
});

// ─── checkSavedTracks ───────────────────────────────────────────────────────

describe('checkSavedTracks', () => {
  it('returns boolean array', async () => {
    const result = await checkSavedTracks('user-1', 'circle-1', ['track-1', 'track-2']);
    expect(result).toEqual([true, false]);
  });
});

// ─── startPlayback ──────────────────────────────────────────────────────────

describe('startPlayback', () => {
  it('sends context_uri and offset when contextUri is provided', async () => {
    let capturedBody: Record<string, unknown> | null = null;
    server.use(
      http.put(`${SPOTIFY_API}/me/player/play`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return new HttpResponse(null, { status: 204 });
      })
    );

    await startPlayback('user-1', 'circle-1', {
      contextUri: 'spotify:playlist:abc',
      trackUri: 'spotify:track:xyz',
    });

    expect(capturedBody).toEqual({
      context_uri: 'spotify:playlist:abc',
      offset: { uri: 'spotify:track:xyz' },
    });
  });

  it('sends uris array when only trackUri is provided', async () => {
    let capturedBody: Record<string, unknown> | null = null;
    server.use(
      http.put(`${SPOTIFY_API}/me/player/play`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return new HttpResponse(null, { status: 204 });
      })
    );

    await startPlayback('user-1', 'circle-1', {
      trackUri: 'spotify:track:xyz',
    });

    expect(capturedBody).toEqual({
      uris: ['spotify:track:xyz'],
    });
  });
});

// ─── reorderPlaylistTracks ──────────────────────────────────────────────────

describe('reorderPlaylistTracks', () => {
  it('sends URIs and returns snapshot_id', async () => {
    let capturedBody: Record<string, unknown> | null = null;
    server.use(
      http.put(`${SPOTIFY_API}/playlists/:id/items`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ snapshot_id: 'snap-reorder' });
      })
    );

    const result = await reorderPlaylistTracks('user-1', 'circle-1', 'playlist-1', [
      'spotify:track:a',
      'spotify:track:b',
      'spotify:track:c',
    ]);
    expect(result.snapshot_id).toBe('snap-reorder');
    expect(capturedBody).toEqual({
      uris: ['spotify:track:a', 'spotify:track:b', 'spotify:track:c'],
    });
  });
});

// ─── getPlaylistDetails ─────────────────────────────────────────────────────

describe('getPlaylistDetails', () => {
  it('parses response into name, description, and imageUrl', async () => {
    const details = await getPlaylistDetails('user-1', 'circle-1', 'playlist-1');
    expect(details).toEqual({
      name: 'Test Playlist',
      description: 'A test playlist',
      imageUrl: 'https://img.example.com',
      trackCount: 1,
      collaborative: true,
      isPublic: false,
    });
  });
});

// ─── followPlaylist ─────────────────────────────────────────────────────────

describe('followPlaylist', () => {
  it('sends PUT to followers endpoint without throwing', async () => {
    let wasCalled = false;
    server.use(
      http.put(`${SPOTIFY_API}/playlists/:id/followers`, () => {
        wasCalled = true;
        return new HttpResponse(null, { status: 200 });
      })
    );

    await followPlaylist('user-1', 'circle-1', 'playlist-1');
    expect(wasCalled).toBe(true);
  });
});

// ─── spotifyFetch error handling (tested through exported functions) ─────────

describe('spotifyFetch error handling', () => {
  it('retries on 429 response and eventually succeeds', async () => {
    // First call returns 429 with Retry-After: 0 (no wait), second call hits default handler (200)
    server.use(
      http.get(
        `${SPOTIFY_API}/me/player/recently-played`,
        () => {
          return new HttpResponse('Rate Limited', {
            status: 429,
            headers: { 'Retry-After': '0' },
          });
        },
        { once: true }
      )
    );

    // The retry should hit the default handler which returns 200
    const items = await getRecentlyPlayed('user-1', 'circle-1');
    expect(items).toHaveLength(1);
    expect(items[0]!.track.id).toBe('track-1');
  });

  it('retries on 401 by forcing token refresh', async () => {
    // First call returns 401, second call returns 200 (default handler)
    server.use(
      http.get(
        `${SPOTIFY_API}/search`,
        () => {
          return new HttpResponse('Unauthorized', { status: 401 });
        },
        { once: true }
      )
    );

    // On 401, spotifyFetch sets tokenExpiresAt=0 via db.update, then retries
    const tracks = await searchTracks('user-1', 'circle-1', 'test query');
    expect(tracks).toHaveLength(1);
    // Verify the token was force-expired in the DB
    expect(db.update).toHaveBeenCalled();
  });

  it('propagates TokenInvalidError from refreshAccessToken', async () => {
    // Set up a member with no refresh token -- refreshAccessToken will throw TokenInvalidError
    mockDbMember({ refreshToken: null });

    await expect(searchTracks('user-1', 'circle-1', 'query')).rejects.toThrow(TokenInvalidError);
  });
});
