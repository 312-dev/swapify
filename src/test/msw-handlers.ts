/**
 * Reusable MSW 2.x handlers for Spotify API endpoints.
 * These provide "happy path" default responses for use in tests.
 */
import { http, HttpResponse } from 'msw';

const SPOTIFY_API = 'https://api.spotify.com/v1';
const SPOTIFY_ACCOUNTS = 'https://accounts.spotify.com';

// ─── Default Mock Data ──────────────────────────────────────────────────────

export const mockTrack = {
  id: 'track-1',
  uri: 'spotify:track:track-1',
  name: 'Mock Track',
  duration_ms: 200000,
  artists: [{ id: 'artist-1', name: 'Mock Artist' }],
  album: {
    id: 'album-1',
    name: 'Mock Album',
    images: [{ url: 'https://img.example.com', height: 300, width: 300 }],
  },
  external_urls: { spotify: 'https://open.spotify.com/track/track-1' },
};

export const mockUser = {
  id: 'user-1',
  display_name: 'Test User',
  images: [],
  external_urls: { spotify: 'https://open.spotify.com/user/user-1' },
};

export const mockPlaylist = {
  id: 'playlist-1',
  name: 'Test Playlist',
  collaborative: true,
  public: false,
  snapshot_id: 'snap-1',
  external_urls: { spotify: '' },
  owner: {
    id: 'user-1',
    display_name: 'Test',
    images: [],
    external_urls: { spotify: '' },
  },
};

// ─── Handlers ───────────────────────────────────────────────────────────────

export const handlers = [
  // Token refresh
  http.post(`${SPOTIFY_ACCOUNTS}/api/token`, () => {
    return HttpResponse.json({
      access_token: 'new-access-token',
      token_type: 'Bearer',
      scope: 'user-read-private',
      expires_in: 3600,
    });
  }),

  // Profile
  http.get(`${SPOTIFY_API}/me`, () => {
    return HttpResponse.json(mockUser);
  }),

  // Create playlist
  http.post(`${SPOTIFY_API}/me/playlists`, () => {
    return HttpResponse.json(mockPlaylist);
  }),

  // Get playlist items
  http.get(`${SPOTIFY_API}/playlists/:id/items`, () => {
    return HttpResponse.json({
      items: [
        {
          added_at: new Date().toISOString(),
          added_by: { id: 'user-1', uri: '', external_urls: { spotify: '' } },
          track: mockTrack,
        },
      ],
      next: null,
    });
  }),

  // Add items to playlist
  http.post(`${SPOTIFY_API}/playlists/:id/items`, () => {
    return HttpResponse.json({ snapshot_id: 'snap-add' });
  }),

  // Remove items from playlist
  http.delete(`${SPOTIFY_API}/playlists/:id/items`, () => {
    return HttpResponse.json({ snapshot_id: 'snap-del' });
  }),

  // Search
  http.get(`${SPOTIFY_API}/search`, () => {
    return HttpResponse.json({
      tracks: { items: [mockTrack], total: 1, limit: 10, offset: 0 },
    });
  }),

  // Currently playing
  http.get(`${SPOTIFY_API}/me/player/currently-playing`, () => {
    return HttpResponse.json({
      item: mockTrack,
      progress_ms: 50000,
      is_playing: true,
    });
  }),

  // Recently played
  http.get(`${SPOTIFY_API}/me/player/recently-played`, () => {
    return HttpResponse.json({
      items: [
        {
          track: mockTrack,
          played_at: new Date().toISOString(),
          context: null,
        },
      ],
    });
  }),

  // Start playback
  http.put(`${SPOTIFY_API}/me/player/play`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // Check saved tracks
  http.get(`${SPOTIFY_API}/me/tracks/contains`, () => {
    return HttpResponse.json([true, false]);
  }),

  // Save tracks
  http.put(`${SPOTIFY_API}/me/tracks`, () => {
    return new HttpResponse(null, { status: 200 });
  }),

  // Remove saved tracks
  http.delete(`${SPOTIFY_API}/me/tracks`, () => {
    return new HttpResponse(null, { status: 200 });
  }),

  // Playlist details
  http.get(`${SPOTIFY_API}/playlists/:id`, () => {
    return HttpResponse.json({
      name: 'Test Playlist',
      description: 'A test playlist',
      images: [{ url: 'https://img.example.com' }],
    });
  }),

  // Follow playlist
  http.put(`${SPOTIFY_API}/playlists/:id/followers`, () => {
    return new HttpResponse(null, { status: 200 });
  }),

  // Check playlist followers
  http.get(`${SPOTIFY_API}/playlists/:id/followers/contains`, () => {
    return HttpResponse.json([true]);
  }),

  // Reorder tracks
  http.put(`${SPOTIFY_API}/playlists/:id/tracks`, () => {
    return HttpResponse.json({ snapshot_id: 'snap-reorder' });
  }),
];
