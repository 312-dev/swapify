import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDb, teardownTestDb, truncateAllTables } from '@/test/db-setup';
import { resetIdCounter } from '@/test/helpers';
import {
  users,
  circles,
  circleMembers,
  playlists,
  playlistMembers,
  playlistTracks,
  trackReactions,
} from '@/db/schema';

// ─── Mocks (hoisted before any imports of mocked modules) ────────────────────

vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn().mockResolvedValue({
    id: 'user-1',
    spotifyId: 'spotify-user-1',
    displayName: 'Test User',
    avatarUrl: null,
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/notifications', () => ({
  notify: vi.fn(),
  notifyPlaylistMembers: vi.fn(),
}));

vi.mock('@/lib/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/utils')>();
  return {
    ...actual,
    generateId: actual.generateId,
  };
});

// ─── Test DB setup ───────────────────────────────────────────────────────────

let testDb: Awaited<ReturnType<typeof setupTestDb>>;

beforeAll(async () => {
  testDb = await setupTestDb();
  vi.doMock('@/db', () => ({ db: testDb }));
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await truncateAllTables(testDb);
  resetIdCounter();
  vi.clearAllMocks();
});

// ─── Seed helpers ────────────────────────────────────────────────────────────

async function seedBaseData() {
  // User 1 (the authenticated user)
  await testDb.insert(users).values({
    id: 'user-1',
    spotifyId: 'spotify-user-1',
    displayName: 'Test User',
    avatarUrl: null,
    notifyPush: false,
    notifyEmail: false,
    autoNegativeReactions: true,
    hasCompletedTour: false,
  });

  // User 2 (another member who added the track)
  await testDb.insert(users).values({
    id: 'user-2',
    spotifyId: 'spotify-user-2',
    displayName: 'Other User',
    avatarUrl: null,
    notifyPush: false,
    notifyEmail: false,
    autoNegativeReactions: true,
    hasCompletedTour: false,
  });

  // Circle
  await testDb.insert(circles).values({
    id: 'circle-1',
    name: 'Test Circle',
    spotifyClientId: 'client-123',
    hostUserId: 'user-1',
    inviteCode: 'inv-circle-1',
    maxMembers: 5,
  });

  // Circle members
  await testDb.insert(circleMembers).values({
    id: 'cm-1',
    circleId: 'circle-1',
    userId: 'user-1',
    role: 'host',
    accessToken: 'token-1',
    refreshToken: 'refresh-1',
    tokenExpiresAt: Math.floor(Date.now() / 1000) + 3600,
  });
  await testDb.insert(circleMembers).values({
    id: 'cm-2',
    circleId: 'circle-1',
    userId: 'user-2',
    role: 'member',
    accessToken: 'token-2',
    refreshToken: 'refresh-2',
    tokenExpiresAt: Math.floor(Date.now() / 1000) + 3600,
  });

  // Playlist
  await testDb.insert(playlists).values({
    id: 'playlist-1',
    name: 'Test Playlist',
    spotifyPlaylistId: 'sp-playlist-1',
    ownerId: 'user-1',
    circleId: 'circle-1',
    inviteCode: 'inv-playlist-1',
    maxTrackAgeDays: 7,
    removalDelay: 'immediate',
    sortMode: 'order_added',
    archiveThreshold: 'none',
  });

  // Playlist members
  await testDb.insert(playlistMembers).values({
    id: 'pm-1',
    playlistId: 'playlist-1',
    userId: 'user-1',
  });
  await testDb.insert(playlistMembers).values({
    id: 'pm-2',
    playlistId: 'playlist-1',
    userId: 'user-2',
  });

  // A track added by user-2 (so user-1 can react to it)
  await testDb.insert(playlistTracks).values({
    id: 'track-1',
    playlistId: 'playlist-1',
    spotifyTrackUri: 'spotify:track:abc123',
    spotifyTrackId: 'abc123',
    trackName: 'Cool Song',
    artistName: 'Cool Artist',
    addedByUserId: 'user-2',
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('POST /api/playlists/[playlistId]/reactions', () => {
  it('returns 403 when user is not a member', async () => {
    await seedBaseData();
    // Remove user-1 from playlist membership
    const { eq, and } = await import('drizzle-orm');
    await testDb
      .delete(playlistMembers)
      .where(
        and(eq(playlistMembers.playlistId, 'playlist-1'), eq(playlistMembers.userId, 'user-1'))
      );

    const { POST } = await import('./route');
    const request = new Request('https://test.swapify.app/api/playlists/playlist-1/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spotifyTrackId: 'abc123', reaction: 'thumbs_up' }),
    });

    const response = await POST(request as any, {
      params: Promise.resolve({ playlistId: 'playlist-1' }),
    });
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe('Not a member');
  });

  it('returns 400 when spotifyTrackId is missing', async () => {
    await seedBaseData();

    const { POST } = await import('./route');
    const request = new Request('https://test.swapify.app/api/playlists/playlist-1/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reaction: 'thumbs_up' }),
    });

    const response = await POST(request as any, {
      params: Promise.resolve({ playlistId: 'playlist-1' }),
    });
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Missing spotifyTrackId or reaction');
  });

  it('returns 400 when reaction is missing', async () => {
    await seedBaseData();

    const { POST } = await import('./route');
    const request = new Request('https://test.swapify.app/api/playlists/playlist-1/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spotifyTrackId: 'abc123' }),
    });

    const response = await POST(request as any, {
      params: Promise.resolve({ playlistId: 'playlist-1' }),
    });
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Missing spotifyTrackId or reaction');
  });

  it('returns 403 when reacting to own track', async () => {
    await seedBaseData();
    // Add a track by user-1
    await testDb.insert(playlistTracks).values({
      id: 'track-own',
      playlistId: 'playlist-1',
      spotifyTrackUri: 'spotify:track:own123',
      spotifyTrackId: 'own123',
      trackName: 'My Song',
      artistName: 'My Artist',
      addedByUserId: 'user-1',
    });

    const { POST } = await import('./route');
    const request = new Request('https://test.swapify.app/api/playlists/playlist-1/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spotifyTrackId: 'own123', reaction: 'thumbs_up' }),
    });

    const response = await POST(request as any, {
      params: Promise.resolve({ playlistId: 'playlist-1' }),
    });
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe('Cannot react to your own track');
  });

  it('successfully adds a new reaction', async () => {
    await seedBaseData();

    const { POST } = await import('./route');
    const request = new Request('https://test.swapify.app/api/playlists/playlist-1/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spotifyTrackId: 'abc123', reaction: 'thumbs_up' }),
    });

    const response = await POST(request as any, {
      params: Promise.resolve({ playlistId: 'playlist-1' }),
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);

    // Verify DB insert
    const { eq, and } = await import('drizzle-orm');
    const reactions = await testDb.query.trackReactions.findMany({
      where: and(
        eq(trackReactions.playlistId, 'playlist-1'),
        eq(trackReactions.spotifyTrackId, 'abc123'),
        eq(trackReactions.userId, 'user-1')
      ),
    });
    expect(reactions).toHaveLength(1);
    expect(reactions[0]!.reaction).toBe('thumbs_up');
    expect(reactions[0]!.isAuto).toBe(false);
  });

  it('successfully updates an existing reaction', async () => {
    await seedBaseData();

    // Insert an existing reaction
    await testDb.insert(trackReactions).values({
      id: 'reaction-1',
      playlistId: 'playlist-1',
      spotifyTrackId: 'abc123',
      userId: 'user-1',
      reaction: 'thumbs_down',
      isAuto: false,
    });

    const { POST } = await import('./route');
    const request = new Request('https://test.swapify.app/api/playlists/playlist-1/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spotifyTrackId: 'abc123', reaction: 'thumbs_up' }),
    });

    const response = await POST(request as any, {
      params: Promise.resolve({ playlistId: 'playlist-1' }),
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);

    // Verify the reaction was updated (not duplicated)
    const { eq, and } = await import('drizzle-orm');
    const reactions = await testDb.query.trackReactions.findMany({
      where: and(
        eq(trackReactions.playlistId, 'playlist-1'),
        eq(trackReactions.spotifyTrackId, 'abc123'),
        eq(trackReactions.userId, 'user-1')
      ),
    });
    expect(reactions).toHaveLength(1);
    expect(reactions[0]!.reaction).toBe('thumbs_up');
  });
});

describe('DELETE /api/playlists/[playlistId]/reactions', () => {
  it('successfully removes a reaction', async () => {
    await seedBaseData();

    // Insert a reaction to delete
    await testDb.insert(trackReactions).values({
      id: 'reaction-del',
      playlistId: 'playlist-1',
      spotifyTrackId: 'abc123',
      userId: 'user-1',
      reaction: 'thumbs_up',
      isAuto: false,
    });

    const { DELETE } = await import('./route');
    const request = new Request('https://test.swapify.app/api/playlists/playlist-1/reactions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spotifyTrackId: 'abc123' }),
    });

    const response = await DELETE(request as any, {
      params: Promise.resolve({ playlistId: 'playlist-1' }),
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);

    // Verify the reaction was removed from DB
    const { eq, and } = await import('drizzle-orm');
    const reactions = await testDb.query.trackReactions.findMany({
      where: and(
        eq(trackReactions.playlistId, 'playlist-1'),
        eq(trackReactions.spotifyTrackId, 'abc123'),
        eq(trackReactions.userId, 'user-1')
      ),
    });
    expect(reactions).toHaveLength(0);
  });
});
