import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// Mock auth
vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(),
  getSession: vi.fn(),
}));

// Mock rate limit
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockReturnValue(null),
  RATE_LIMITS: {
    mutation: { maxTokens: 20, refillRate: 0.33 },
    search: { maxTokens: 30, refillRate: 0.5 },
  },
}));

// Mock DB
vi.mock('@/db', () => ({
  db: {
    query: {
      playlistMembers: { findFirst: vi.fn(), findMany: vi.fn() },
      playlists: { findFirst: vi.fn() },
      playlistTracks: { findFirst: vi.fn(), findMany: vi.fn() },
      trackListens: { findMany: vi.fn() },
      trackReactions: { findMany: vi.fn() },
      circleMembers: { findMany: vi.fn() },
    },
    insert: vi.fn(() => ({ values: vi.fn() })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({ where: vi.fn().mockResolvedValue([{ count: 0 }]) })),
    })),
  },
}));

vi.mock('@/db/schema', () => ({
  playlists: {},
  playlistMembers: {},
  playlistTracks: {},
  trackListens: {},
  trackReactions: {},
  circleMembers: {},
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  desc: vi.fn(),
  isNull: vi.fn(),
  isNotNull: vi.fn(),
  sql: vi.fn(),
}));

// Mock Spotify
vi.mock('@/lib/spotify', () => ({
  createPlaylist: vi.fn(),
  uploadPlaylistImage: vi.fn(),
  getPlaylistDetails: vi.fn(),
  addItemsToPlaylist: vi.fn(),
  getPlaylistItems: vi.fn(),
  checkSavedTracks: vi.fn(),
  searchTracks: vi.fn(),
  isRateLimited: vi.fn().mockReturnValue(false),
}));

// Mock utils
vi.mock('@/lib/utils', () => ({
  generateId: vi.fn().mockReturnValue('test-id'),
  generateInviteCode: vi.fn().mockReturnValue('test-code'),
  getFirstName: vi.fn((name: string) => name.split(' ')[0]),
  formatPlaylistName: vi.fn((names: string[]) => names.join('+') + ' Swapify'),
}));

// Mock notifications and other side effects
vi.mock('@/lib/notifications', () => ({
  notifyPlaylistMembers: vi.fn(),
  notifyCircleMembers: vi.fn(),
}));
vi.mock('@/lib/playlist-sort', () => ({ sortPlaylistTracks: vi.fn() }));
vi.mock('@/lib/polling', () => ({ setAutoReaction: vi.fn() }));
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { GET, POST } from '@/app/api/playlists/route';
import { requireAuth, getSession } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { db } from '@/db';
import { createPlaylist } from '@/lib/spotify';

const mockUser = {
  id: 'user-1',
  displayName: 'Test User',
  avatarUrl: 'https://img.spotify.com/avatar.jpg',
};

function createRequest(url: string, options?: RequestInit) {
  return new NextRequest(new URL(url, 'https://test.swapify.app'), options as any);
}

describe('POST /api/playlists', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue(mockUser as any);
    vi.mocked(getSession).mockResolvedValue({ activeCircleId: 'circle-1' } as any);
    vi.mocked(checkRateLimit).mockReturnValue(null);
  });

  it('returns 400 when no active circle is selected', async () => {
    vi.mocked(getSession).mockResolvedValue({ activeCircleId: undefined } as any);

    const request = createRequest('/api/playlists', {
      method: 'POST',
      body: JSON.stringify({ name: 'My Playlist' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('No active circle selected');
  });

  it('creates a playlist and returns it', async () => {
    vi.mocked(createPlaylist).mockResolvedValue({
      id: 'sp-playlist-1',
      name: 'My Playlist',
      collaborative: true,
      public: false,
      snapshot_id: 'snap-1',
      external_urls: { spotify: 'https://open.spotify.com/playlist/sp-playlist-1' },
      owner: {
        id: 'user-1',
        display_name: 'Test User',
        images: [],
        external_urls: { spotify: 'https://open.spotify.com/user/user-1' },
      },
    } as any);

    // Mock db.insert to return a chainable object
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    } as any);

    // Mock the final playlist query
    vi.mocked(db.query.playlists.findFirst).mockResolvedValue({
      id: 'test-id',
      name: 'My Playlist',
      ownerId: 'user-1',
      spotifyPlaylistId: 'sp-playlist-1',
      circleId: 'circle-1',
      inviteCode: 'test-code',
      imageUrl: null,
      owner: { id: 'user-1', displayName: 'Test User', avatarUrl: null },
      members: [
        {
          user: {
            id: 'user-1',
            displayName: 'Test User',
            avatarUrl: 'https://img.spotify.com/avatar.jpg',
          },
        },
      ],
    } as any);

    const request = createRequest('/api/playlists', {
      method: 'POST',
      body: JSON.stringify({ name: 'My Playlist' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.id).toBe('test-id');
    expect(data.name).toBe('My Playlist');
    expect(data.inviteCode).toBe('test-code');
    expect(data.spotifyUrl).toBe('https://open.spotify.com/playlist/sp-playlist-1');

    // Verify createPlaylist was called with the right arguments
    expect(createPlaylist).toHaveBeenCalledWith('user-1', 'circle-1', 'My Playlist', undefined);

    // Verify db.insert was called twice (playlist + member)
    expect(db.insert).toHaveBeenCalledTimes(2);
  });

  it('returns rate-limited response when checkRateLimit returns a 429', async () => {
    vi.mocked(checkRateLimit).mockReturnValue(
      NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    );

    const request = createRequest('/api/playlists', {
      method: 'POST',
      body: JSON.stringify({ name: 'My Playlist' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    expect(response.status).toBe(429);
    const data = await response.json();
    expect(data.error).toBe('Too many requests');
  });
});

describe('GET /api/playlists', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue(mockUser as any);
  });

  it('returns playlists with member and track counts', async () => {
    // Mock memberships query
    vi.mocked(db.query.playlistMembers.findMany).mockResolvedValue([
      {
        playlist: {
          id: 'playlist-1',
          name: 'Test Playlist',
          ownerId: 'user-1',
          owner: { id: 'user-1', displayName: 'Test User', avatarUrl: null },
          members: [
            {
              user: {
                id: 'user-1',
                displayName: 'Test User',
                avatarUrl: 'https://img.spotify.com/avatar.jpg',
              },
            },
            {
              user: {
                id: 'user-2',
                displayName: 'Friend User',
                avatarUrl: null,
              },
            },
          ],
          createdAt: new Date('2025-01-01T00:00:00Z'),
          tracks: [
            {
              spotifyTrackId: 'track-1',
              addedByUserId: 'user-2',
              addedAt: new Date('2025-01-02T00:00:00Z'),
              removedAt: null,
            },
            {
              spotifyTrackId: 'track-2',
              addedByUserId: 'user-1',
              addedAt: new Date('2025-01-03T00:00:00Z'),
              removedAt: null,
            },
            {
              spotifyTrackId: 'track-3',
              addedByUserId: 'user-2',
              addedAt: new Date('2025-01-04T00:00:00Z'),
              removedAt: new Date(), // removed track
            },
          ],
        },
      },
    ] as any);

    // Mock user listens - user has listened to track-1
    vi.mocked(db.query.trackListens.findMany).mockResolvedValue([
      { playlistId: 'playlist-1', spotifyTrackId: 'track-1', userId: 'user-1' },
    ] as any);

    const response = await GET();
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveLength(1);

    const playlist = data[0];
    expect(playlist.id).toBe('playlist-1');
    expect(playlist.memberCount).toBe(2);
    expect(playlist.activeTrackCount).toBe(2); // track-3 is removed
    // unplayedCount: active tracks not added by user and not listened to
    // track-1 was added by user-2 but user listened to it -> not unplayed
    // track-2 was added by user-1 -> excluded (own track)
    // track-3 is removed -> excluded
    expect(playlist.unplayedCount).toBe(0);
    expect(playlist.members).toEqual([
      {
        id: 'user-1',
        displayName: 'Test User',
        avatarUrl: 'https://img.spotify.com/avatar.jpg',
      },
      {
        id: 'user-2',
        displayName: 'Friend User',
        avatarUrl: null,
      },
    ]);
  });
});
