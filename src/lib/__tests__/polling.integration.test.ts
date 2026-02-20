import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDb, teardownTestDb, truncateAllTables } from '@/test/db-setup';

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@/lib/spotify', () => ({
  getRecentlyPlayed: vi.fn().mockResolvedValue([]),
  getCurrentPlayback: vi.fn().mockResolvedValue(null),
  getPlaylistItems: vi.fn().mockResolvedValue([]),
  removeItemsFromPlaylist: vi.fn().mockResolvedValue({ snapshot_id: 'snap' }),
  addItemsToPlaylist: vi.fn().mockResolvedValue({ snapshot_id: 'snap' }),
  checkSavedTracks: vi.fn().mockResolvedValue([]),
  isRateLimited: vi.fn().mockReturnValue(false),
  TokenInvalidError: class TokenInvalidError extends Error {
    userId: string;
    circleId: string;
    constructor(userId: string, circleId: string, msg: string) {
      super(msg);
      this.userId = userId;
      this.circleId = circleId;
      this.name = 'TokenInvalidError';
    }
  },
}));

vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/spotify-config', () => ({
  spotifyConfig: {
    savedCheckEveryNCycles: 999,
    auditEveryNCycles: 999,
    likedSyncEveryNCycles: 999,
    pollIntervalMs: 30000,
  },
  isOverBudget: vi.fn().mockReturnValue(false),
}));

vi.mock('@/lib/notifications', () => ({
  notify: vi.fn(),
  notifyPlaylistMembers: vi.fn(),
  notifyCircleMembers: vi.fn(),
}));

vi.mock('@/lib/playlist-sort', () => ({
  sortPlaylistTracks: vi.fn().mockResolvedValue(undefined),
}));

// CRITICAL: Mock @/db to use the test PGlite database via a lazy getter.
// testDb is assigned in beforeAll, but the getter defers resolution until first access.
let testDb: Awaited<ReturnType<typeof setupTestDb>>;

vi.mock('@/db', () => ({
  get db() {
    return testDb;
  },
}));

// Import module under test AFTER mocks are declared
import { setAutoReaction, runPollCycle } from '@/lib/polling';
import * as spotifyMock from '@/lib/spotify';

// Schema imports for direct DB operations in tests
import {
  users,
  circles,
  circleMembers,
  playlists,
  playlistMembers,
  playlistTracks,
  trackListens,
  trackReactions,
} from '@/db/schema';
import { eq, and } from 'drizzle-orm';

// ─── Seed Helper ────────────────────────────────────────────────────────────

/**
 * Seeds a basic two-user scenario:
 * - user-1 (owner/host), user-2 (member)
 * - circle-1 with both as circle members
 * - playlist-1 (owner=user-1, circle=circle-1, removalDelay='immediate')
 * - Both users are playlist members
 * - track-1 added by user-1 (active, no removedAt)
 */
async function seedBasicScenario() {
  await testDb.insert(users).values([
    { id: 'user-1', spotifyId: 'sp-user-1', displayName: 'Alice' },
    { id: 'user-2', spotifyId: 'sp-user-2', displayName: 'Bob' },
  ]);

  await testDb.insert(circles).values({
    id: 'circle-1',
    name: 'Test Circle',
    spotifyClientId: 'test-client-id',
    hostUserId: 'user-1',
    inviteCode: 'invite-c1',
  });

  await testDb.insert(circleMembers).values([
    {
      id: 'cm-1',
      circleId: 'circle-1',
      userId: 'user-1',
      role: 'host',
      accessToken: 'token-1',
      refreshToken: 'refresh-1',
      tokenExpiresAt: Math.floor(Date.now() / 1000) + 3600,
    },
    {
      id: 'cm-2',
      circleId: 'circle-1',
      userId: 'user-2',
      role: 'member',
      accessToken: 'token-2',
      refreshToken: 'refresh-2',
      tokenExpiresAt: Math.floor(Date.now() / 1000) + 3600,
    },
  ]);

  await testDb.insert(playlists).values({
    id: 'playlist-1',
    name: 'Test Swaplist',
    spotifyPlaylistId: 'sp-playlist-1',
    ownerId: 'user-1',
    circleId: 'circle-1',
    inviteCode: 'invite-p1',
    removalDelay: 'immediate',
  });

  await testDb.insert(playlistMembers).values([
    { id: 'pm-1', playlistId: 'playlist-1', userId: 'user-1' },
    { id: 'pm-2', playlistId: 'playlist-1', userId: 'user-2' },
  ]);

  await testDb.insert(playlistTracks).values({
    id: 'track-1',
    playlistId: 'playlist-1',
    spotifyTrackUri: 'spotify:track:abc123',
    spotifyTrackId: 'abc123',
    trackName: 'Test Track',
    artistName: 'Test Artist',
    durationMs: 200000,
    addedByUserId: 'user-1',
  });
}

/**
 * Seeds a three-user scenario for completion tests.
 * user-1 is the adder, user-2 and user-3 are the non-adder members.
 */
async function seedThreeUserScenario(removalDelay: string = 'immediate') {
  await testDb.insert(users).values([
    { id: 'user-1', spotifyId: 'sp-user-1', displayName: 'Alice' },
    { id: 'user-2', spotifyId: 'sp-user-2', displayName: 'Bob' },
    { id: 'user-3', spotifyId: 'sp-user-3', displayName: 'Carol' },
  ]);

  await testDb.insert(circles).values({
    id: 'circle-1',
    name: 'Test Circle',
    spotifyClientId: 'test-client-id',
    hostUserId: 'user-1',
    inviteCode: 'invite-c1',
  });

  await testDb.insert(circleMembers).values([
    {
      id: 'cm-1',
      circleId: 'circle-1',
      userId: 'user-1',
      role: 'host',
      accessToken: 'token-1',
      refreshToken: 'refresh-1',
      tokenExpiresAt: Math.floor(Date.now() / 1000) + 3600,
    },
    {
      id: 'cm-2',
      circleId: 'circle-1',
      userId: 'user-2',
      role: 'member',
      accessToken: 'token-2',
      refreshToken: 'refresh-2',
      tokenExpiresAt: Math.floor(Date.now() / 1000) + 3600,
    },
    {
      id: 'cm-3',
      circleId: 'circle-1',
      userId: 'user-3',
      role: 'member',
      accessToken: 'token-3',
      refreshToken: 'refresh-3',
      tokenExpiresAt: Math.floor(Date.now() / 1000) + 3600,
    },
  ]);

  await testDb.insert(playlists).values({
    id: 'playlist-1',
    name: 'Test Swaplist',
    spotifyPlaylistId: 'sp-playlist-1',
    ownerId: 'user-1',
    circleId: 'circle-1',
    inviteCode: 'invite-p1',
    removalDelay,
  });

  await testDb.insert(playlistMembers).values([
    { id: 'pm-1', playlistId: 'playlist-1', userId: 'user-1' },
    { id: 'pm-2', playlistId: 'playlist-1', userId: 'user-2' },
    { id: 'pm-3', playlistId: 'playlist-1', userId: 'user-3' },
  ]);

  await testDb.insert(playlistTracks).values({
    id: 'track-1',
    playlistId: 'playlist-1',
    spotifyTrackUri: 'spotify:track:abc123',
    spotifyTrackId: 'abc123',
    trackName: 'Test Track',
    artistName: 'Test Artist',
    durationMs: 200000,
    addedByUserId: 'user-1',
  });
}

// ─── Test Suite ─────────────────────────────────────────────────────────────

describe('polling integration tests', () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await truncateAllTables(testDb);
    vi.clearAllMocks();
    // Reset default mock return values
    vi.mocked(spotifyMock.getRecentlyPlayed).mockResolvedValue([]);
    vi.mocked(spotifyMock.getCurrentPlayback).mockResolvedValue(null);
    vi.mocked(spotifyMock.getPlaylistItems).mockResolvedValue([]);
    vi.mocked(spotifyMock.removeItemsFromPlaylist).mockResolvedValue({ snapshot_id: 'snap' });
    vi.mocked(spotifyMock.isRateLimited).mockReturnValue(false);
  });

  // ─── setAutoReaction ────────────────────────────────────────────────────

  describe('setAutoReaction', () => {
    it('creates a new auto reaction when none exists', async () => {
      await seedBasicScenario();

      await setAutoReaction('playlist-1', 'abc123', 'user-2', 'thumbs_down');

      const reactions = await testDb.query.trackReactions.findMany({
        where: and(
          eq(trackReactions.playlistId, 'playlist-1'),
          eq(trackReactions.spotifyTrackId, 'abc123'),
          eq(trackReactions.userId, 'user-2')
        ),
      });

      expect(reactions).toHaveLength(1);
      expect(reactions[0]!.reaction).toBe('thumbs_down');
      expect(reactions[0]!.isAuto).toBe(true);
    });

    it('upgrades auto thumbs_down to thumbs_up', async () => {
      await seedBasicScenario();

      // First: set auto thumbs_down (skip detection)
      await setAutoReaction('playlist-1', 'abc123', 'user-2', 'thumbs_down');

      // Then: upgrade to thumbs_up (library save detected)
      await setAutoReaction('playlist-1', 'abc123', 'user-2', 'thumbs_up');

      const reactions = await testDb.query.trackReactions.findMany({
        where: and(
          eq(trackReactions.playlistId, 'playlist-1'),
          eq(trackReactions.spotifyTrackId, 'abc123'),
          eq(trackReactions.userId, 'user-2')
        ),
      });

      expect(reactions).toHaveLength(1);
      expect(reactions[0]!.reaction).toBe('thumbs_up');
      expect(reactions[0]!.isAuto).toBe(true);
    });

    it('does NOT overwrite a manual (non-auto) reaction', async () => {
      await seedBasicScenario();

      // Insert a manual reaction directly
      await testDb.insert(trackReactions).values({
        id: 'reaction-manual',
        playlistId: 'playlist-1',
        spotifyTrackId: 'abc123',
        userId: 'user-2',
        reaction: 'fire',
        isAuto: false,
      });

      // Attempt to set auto thumbs_up
      await setAutoReaction('playlist-1', 'abc123', 'user-2', 'thumbs_up');

      const reaction = await testDb.query.trackReactions.findFirst({
        where: and(
          eq(trackReactions.playlistId, 'playlist-1'),
          eq(trackReactions.spotifyTrackId, 'abc123'),
          eq(trackReactions.userId, 'user-2')
        ),
      });

      expect(reaction!.reaction).toBe('fire');
      expect(reaction!.isAuto).toBe(false);
    });

    it('does NOT downgrade an existing auto thumbs_up to thumbs_down', async () => {
      await seedBasicScenario();

      // First: set auto thumbs_up
      await setAutoReaction('playlist-1', 'abc123', 'user-2', 'thumbs_up');

      // Attempt to downgrade to thumbs_down
      await setAutoReaction('playlist-1', 'abc123', 'user-2', 'thumbs_down');

      const reaction = await testDb.query.trackReactions.findFirst({
        where: and(
          eq(trackReactions.playlistId, 'playlist-1'),
          eq(trackReactions.spotifyTrackId, 'abc123'),
          eq(trackReactions.userId, 'user-2')
        ),
      });

      expect(reaction!.reaction).toBe('thumbs_up');
    });

    it('handles duplicate insert gracefully (no throw)', async () => {
      await seedBasicScenario();

      await setAutoReaction('playlist-1', 'abc123', 'user-2', 'thumbs_down');
      // Second call with same reaction should not throw
      await expect(
        setAutoReaction('playlist-1', 'abc123', 'user-2', 'thumbs_down')
      ).resolves.toBeUndefined();

      const reactions = await testDb.query.trackReactions.findMany({
        where: and(
          eq(trackReactions.playlistId, 'playlist-1'),
          eq(trackReactions.spotifyTrackId, 'abc123'),
          eq(trackReactions.userId, 'user-2')
        ),
      });

      expect(reactions).toHaveLength(1);
    });
  });

  // ─── runPollCycle basics ──────────────────────────────────────────────────

  describe('runPollCycle basics', () => {
    it('returns usersPolled: 0 when there are no active tracks', async () => {
      // No seed data at all -- empty DB
      const result = await runPollCycle();

      expect(result.usersPolled).toBe(0);
      expect(result.listensRecorded).toBe(0);
      expect(result.skipsDetected).toBe(0);
      expect(result.tracksRemoved).toBe(0);
    });

    it('records a full listen when recently played includes a tracked track', async () => {
      await seedBasicScenario();

      const playedAt = new Date().toISOString();

      // Mock: user-2's recently played includes the tracked track
      vi.mocked(spotifyMock.getRecentlyPlayed).mockImplementation(async (userId: string) => {
        if (userId === 'user-2') {
          return [
            {
              track: {
                id: 'abc123',
                uri: 'spotify:track:abc123',
                name: 'Test Track',
                duration_ms: 200000,
                artists: [{ id: 'artist-1', name: 'Test Artist' }],
                album: { id: 'album-1', name: 'Test Album', images: [] },
                external_urls: { spotify: 'https://open.spotify.com/track/abc123' },
              },
              played_at: playedAt,
              context: null,
            },
          ];
        }
        return [];
      });

      const result = await runPollCycle();

      expect(result.usersPolled).toBeGreaterThanOrEqual(1);
      expect(result.listensRecorded).toBeGreaterThanOrEqual(1);

      // Verify the listen was recorded in the DB
      const listens = await testDb.query.trackListens.findMany({
        where: and(
          eq(trackListens.playlistId, 'playlist-1'),
          eq(trackListens.spotifyTrackId, 'abc123'),
          eq(trackListens.userId, 'user-2')
        ),
      });

      expect(listens).toHaveLength(1);
      expect(listens[0]!.wasSkipped).toBe(false);
    });

    it('detects and records a skip when progress < 50%', async () => {
      await seedBasicScenario();

      // Set lastPlaybackJson on user-2's circleMembers to show they were playing track-1
      // at 20% progress (40000ms of 200000ms)
      const snapshot = JSON.stringify({
        trackId: 'abc123',
        progressMs: 40000,
        durationMs: 200000,
        capturedAt: Date.now() - 10000,
      });

      await testDb
        .update(circleMembers)
        .set({ lastPlaybackJson: snapshot })
        .where(eq(circleMembers.id, 'cm-2'));

      // Mock: getCurrentPlayback returns a DIFFERENT track (user switched)
      vi.mocked(spotifyMock.getCurrentPlayback).mockImplementation(async (userId: string) => {
        if (userId === 'user-2') {
          return {
            is_playing: true,
            progress_ms: 5000,
            item: {
              id: 'different-track',
              uri: 'spotify:track:different',
              name: 'Different Track',
              duration_ms: 180000,
              artists: [{ id: 'a2', name: 'Other Artist' }],
              album: { id: 'alb2', name: 'Other Album', images: [] },
              external_urls: { spotify: 'https://open.spotify.com/track/different' },
            },
          } as ReturnType<typeof spotifyMock.getCurrentPlayback> extends Promise<infer T>
            ? T
            : never;
        }
        return null;
      });

      // Mock: getRecentlyPlayed does NOT include track abc123 (confirms skip)
      vi.mocked(spotifyMock.getRecentlyPlayed).mockResolvedValue([]);

      const result = await runPollCycle();

      expect(result.skipsDetected).toBeGreaterThanOrEqual(1);

      // Verify the skip was recorded in the DB
      const listens = await testDb.query.trackListens.findMany({
        where: and(
          eq(trackListens.playlistId, 'playlist-1'),
          eq(trackListens.spotifyTrackId, 'abc123'),
          eq(trackListens.userId, 'user-2')
        ),
      });

      expect(listens).toHaveLength(1);
      expect(listens[0]!.wasSkipped).toBe(true);
    });

    it('removes a completed track when all non-adder members have listened (immediate removal)', async () => {
      await seedThreeUserScenario('immediate');

      // Seed: both user-2 and user-3 have already fully listened
      await testDb.insert(trackListens).values([
        {
          id: 'listen-u2',
          playlistId: 'playlist-1',
          spotifyTrackId: 'abc123',
          userId: 'user-2',
          listenedAt: new Date(),
          listenDurationMs: 200000,
          wasSkipped: false,
        },
        {
          id: 'listen-u3',
          playlistId: 'playlist-1',
          spotifyTrackId: 'abc123',
          userId: 'user-3',
          listenedAt: new Date(),
          listenDurationMs: 200000,
          wasSkipped: false,
        },
      ]);

      await runPollCycle();

      // Verify the track was removed (removedAt is set)
      const track = await testDb.query.playlistTracks.findFirst({
        where: eq(playlistTracks.id, 'track-1'),
      });

      expect(track!.removedAt).not.toBeNull();

      // Verify Spotify API was called to remove the track
      expect(spotifyMock.removeItemsFromPlaylist).toHaveBeenCalledWith(
        'user-1', // ownerId
        'circle-1', // circleId
        'sp-playlist-1', // spotifyPlaylistId
        ['spotify:track:abc123']
      );
    });
  });

  // ─── processRecentlyPlayed details ────────────────────────────────────────

  describe('processRecentlyPlayed details (via runPollCycle)', () => {
    it('upgrades a skip to a full listen', async () => {
      await seedBasicScenario();

      // Seed: user-2 previously skipped this track
      await testDb.insert(trackListens).values({
        id: 'listen-skip',
        playlistId: 'playlist-1',
        spotifyTrackId: 'abc123',
        userId: 'user-2',
        listenedAt: new Date(Date.now() - 60000),
        listenDurationMs: 40000,
        wasSkipped: true,
      });

      const playedAt = new Date().toISOString();

      // Mock: user-2 now fully listened to the track
      vi.mocked(spotifyMock.getRecentlyPlayed).mockImplementation(async (userId: string) => {
        if (userId === 'user-2') {
          return [
            {
              track: {
                id: 'abc123',
                uri: 'spotify:track:abc123',
                name: 'Test Track',
                duration_ms: 200000,
                artists: [{ id: 'artist-1', name: 'Test Artist' }],
                album: { id: 'album-1', name: 'Test Album', images: [] },
                external_urls: { spotify: 'https://open.spotify.com/track/abc123' },
              },
              played_at: playedAt,
              context: null,
            },
          ];
        }
        return [];
      });

      await runPollCycle();

      // Verify the skip was upgraded to a full listen
      const listen = await testDb.query.trackListens.findFirst({
        where: and(
          eq(trackListens.playlistId, 'playlist-1'),
          eq(trackListens.spotifyTrackId, 'abc123'),
          eq(trackListens.userId, 'user-2')
        ),
      });

      expect(listen).toBeDefined();
      expect(listen!.wasSkipped).toBe(false);
      expect(listen!.listenDurationMs).toBe(200000);
    });

    it('does not record a listen for the track adder', async () => {
      await seedBasicScenario();

      const playedAt = new Date().toISOString();

      // Mock: user-1 (the adder) listened to their own track
      vi.mocked(spotifyMock.getRecentlyPlayed).mockImplementation(async (userId: string) => {
        if (userId === 'user-1') {
          return [
            {
              track: {
                id: 'abc123',
                uri: 'spotify:track:abc123',
                name: 'Test Track',
                duration_ms: 200000,
                artists: [{ id: 'artist-1', name: 'Test Artist' }],
                album: { id: 'album-1', name: 'Test Album', images: [] },
                external_urls: { spotify: 'https://open.spotify.com/track/abc123' },
              },
              played_at: playedAt,
              context: null,
            },
          ];
        }
        return [];
      });

      await runPollCycle();

      // Verify no listen was recorded for user-1
      const listens = await testDb.query.trackListens.findMany({
        where: and(
          eq(trackListens.playlistId, 'playlist-1'),
          eq(trackListens.spotifyTrackId, 'abc123'),
          eq(trackListens.userId, 'user-1')
        ),
      });

      expect(listens).toHaveLength(0);
    });

    it('does not create duplicate listens', async () => {
      await seedBasicScenario();

      // Seed: user-2 already has a full listen
      await testDb.insert(trackListens).values({
        id: 'listen-existing',
        playlistId: 'playlist-1',
        spotifyTrackId: 'abc123',
        userId: 'user-2',
        listenedAt: new Date(Date.now() - 60000),
        listenDurationMs: 200000,
        wasSkipped: false,
      });

      const playedAt = new Date().toISOString();

      // Mock: user-2 plays the same track again
      vi.mocked(spotifyMock.getRecentlyPlayed).mockImplementation(async (userId: string) => {
        if (userId === 'user-2') {
          return [
            {
              track: {
                id: 'abc123',
                uri: 'spotify:track:abc123',
                name: 'Test Track',
                duration_ms: 200000,
                artists: [{ id: 'artist-1', name: 'Test Artist' }],
                album: { id: 'album-1', name: 'Test Album', images: [] },
                external_urls: { spotify: 'https://open.spotify.com/track/abc123' },
              },
              played_at: playedAt,
              context: null,
            },
          ];
        }
        return [];
      });

      const result = await runPollCycle();

      // listensRecorded should be 0 because the listen already exists
      expect(result.listensRecorded).toBe(0);

      // Verify still only 1 listen row
      const listens = await testDb.query.trackListens.findMany({
        where: and(
          eq(trackListens.playlistId, 'playlist-1'),
          eq(trackListens.spotifyTrackId, 'abc123'),
          eq(trackListens.userId, 'user-2')
        ),
      });

      expect(listens).toHaveLength(1);
    });
  });

  // ─── Completion detection ─────────────────────────────────────────────────

  describe('completion detection', () => {
    it('immediate removal: sets removedAt when all non-adder members have engaged', async () => {
      await seedThreeUserScenario('immediate');

      // Both user-2 and user-3 have full listens
      await testDb.insert(trackListens).values([
        {
          id: 'listen-u2',
          playlistId: 'playlist-1',
          spotifyTrackId: 'abc123',
          userId: 'user-2',
          listenedAt: new Date(),
          listenDurationMs: 200000,
          wasSkipped: false,
        },
        {
          id: 'listen-u3',
          playlistId: 'playlist-1',
          spotifyTrackId: 'abc123',
          userId: 'user-3',
          listenedAt: new Date(),
          listenDurationMs: 200000,
          wasSkipped: false,
        },
      ]);

      await runPollCycle();

      const track = await testDb.query.playlistTracks.findFirst({
        where: eq(playlistTracks.id, 'track-1'),
      });

      expect(track!.removedAt).not.toBeNull();
    });

    it('delayed removal (1h): sets completedAt but NOT removedAt', async () => {
      await seedThreeUserScenario('1h');

      // Both user-2 and user-3 have full listens
      await testDb.insert(trackListens).values([
        {
          id: 'listen-u2',
          playlistId: 'playlist-1',
          spotifyTrackId: 'abc123',
          userId: 'user-2',
          listenedAt: new Date(),
          listenDurationMs: 200000,
          wasSkipped: false,
        },
        {
          id: 'listen-u3',
          playlistId: 'playlist-1',
          spotifyTrackId: 'abc123',
          userId: 'user-3',
          listenedAt: new Date(),
          listenDurationMs: 200000,
          wasSkipped: false,
        },
      ]);

      await runPollCycle();

      const track = await testDb.query.playlistTracks.findFirst({
        where: eq(playlistTracks.id, 'track-1'),
      });

      // completedAt should be set (track is complete)
      expect(track!.completedAt).not.toBeNull();
      // removedAt should NOT be set yet (delay hasn't elapsed)
      expect(track!.removedAt).toBeNull();
    });

    it('reactions count toward completion (reaction without listen still counts as engaged)', async () => {
      await seedThreeUserScenario('immediate');

      // user-2 has a full listen
      await testDb.insert(trackListens).values({
        id: 'listen-u2',
        playlistId: 'playlist-1',
        spotifyTrackId: 'abc123',
        userId: 'user-2',
        listenedAt: new Date(),
        listenDurationMs: 200000,
        wasSkipped: false,
      });

      // user-3 has a reaction (no listen) -- should still count as engaged
      await testDb.insert(trackReactions).values({
        id: 'reaction-u3',
        playlistId: 'playlist-1',
        spotifyTrackId: 'abc123',
        userId: 'user-3',
        reaction: 'thumbs_up',
        isAuto: false,
      });

      await runPollCycle();

      const track = await testDb.query.playlistTracks.findFirst({
        where: eq(playlistTracks.id, 'track-1'),
      });

      // Both members engaged -> track should be removed (immediate delay)
      expect(track!.removedAt).not.toBeNull();
    });
  });
});
