/**
 * Test data factories for Swapify.
 * All IDs use predictable formats for easy assertion.
 */

let counter = 0;
function nextId(prefix: string): string {
  return `${prefix}-${++counter}`;
}

export function resetIdCounter(): void {
  counter = 0;
}

// ─── Database Record Factories ──────────────────────────────────────────────

export function createTestUser(overrides: Record<string, unknown> = {}) {
  const id = nextId('user');
  return {
    id,
    spotifyId: `spotify-${id}`,
    displayName: `Test User ${counter}`,
    avatarUrl: null,
    email: null,
    pendingEmail: null,
    emailVerifyToken: null,
    emailVerifyExpiresAt: null,
    notifyPush: false,
    notifyEmail: false,
    notificationPrefs: null,
    autoNegativeReactions: true,
    recentEmojis: null,
    createdAt: new Date(),
    ...overrides,
  };
}

export function createTestCircle(overrides: Record<string, unknown> = {}) {
  const id = nextId('circle');
  return {
    id,
    name: `Test Circle ${counter}`,
    imageUrl: null,
    spotifyClientId: `client-${id}`,
    hostUserId: 'user-1',
    inviteCode: `inv-${id}`,
    maxMembers: 5,
    createdAt: new Date(),
    ...overrides,
  };
}

export function createTestCircleMember(overrides: Record<string, unknown> = {}) {
  const id = nextId('cm');
  return {
    id,
    circleId: 'circle-1',
    userId: 'user-1',
    role: 'member',
    accessToken: `access-${id}`,
    refreshToken: `refresh-${id}`,
    tokenExpiresAt: Math.floor(Date.now() / 1000) + 3600,
    lastPollCursor: null,
    lastPlaybackJson: null,
    joinedAt: new Date(),
    ...overrides,
  };
}

export function createTestPlaylist(overrides: Record<string, unknown> = {}) {
  const id = nextId('playlist');
  return {
    id,
    name: `Test Playlist ${counter}`,
    description: null,
    imageUrl: null,
    spotifyPlaylistId: `sp-${id}`,
    ownerId: 'user-1',
    circleId: 'circle-1',
    inviteCode: `inv-${id}`,
    archivePlaylistId: null,
    archiveThreshold: 'none',
    maxTracksPerUser: null,
    maxTrackAgeDays: 7,
    removalDelay: 'immediate',
    sortMode: 'order_added',
    vibeName: null,
    createdAt: new Date(),
    ...overrides,
  };
}

export function createTestTrack(overrides: Record<string, unknown> = {}) {
  const id = nextId('track');
  return {
    id,
    playlistId: 'playlist-1',
    spotifyTrackUri: `spotify:track:${id}`,
    spotifyTrackId: id,
    trackName: `Test Track ${counter}`,
    artistName: `Test Artist ${counter}`,
    albumName: `Test Album ${counter}`,
    albumImageUrl: null,
    durationMs: 210_000,
    addedByUserId: 'user-1',
    addedAt: new Date(),
    removedAt: null,
    archivedAt: null,
    completedAt: null,
    ...overrides,
  };
}

// ─── Spotify API Response Factories ─────────────────────────────────────────

export function mockSpotifyTrack(overrides: Record<string, unknown> = {}) {
  const num = ++counter;
  return {
    id: `track-${num}`,
    name: `Mock Track ${num}`,
    uri: `spotify:track:track-${num}`,
    duration_ms: 200_000,
    artists: [{ name: `Artist ${num}` }],
    album: {
      name: `Album ${num}`,
      images: [{ url: `https://i.scdn.co/image/album-${num}`, height: 300, width: 300 }],
    },
    ...overrides,
  };
}

export function mockSpotifyPlaylistItem(overrides: Record<string, unknown> = {}) {
  return {
    track: mockSpotifyTrack(),
    added_at: new Date().toISOString(),
    added_by: { id: 'spotify-user-1' },
    ...overrides,
  };
}

export function mockSpotifyUser(overrides: Record<string, unknown> = {}) {
  const num = ++counter;
  return {
    id: `spotify-user-${num}`,
    display_name: `Spotify User ${num}`,
    images: [{ url: `https://i.scdn.co/image/user-${num}`, height: 300, width: 300 }],
    email: `user${num}@example.com`,
    ...overrides,
  };
}
