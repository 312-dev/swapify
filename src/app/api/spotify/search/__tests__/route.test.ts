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

// Mock Spotify
vi.mock('@/lib/spotify', () => ({
  searchTracks: vi.fn(),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { GET } from '@/app/api/spotify/search/route';
import { requireAuth, getSession } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { searchTracks } from '@/lib/spotify';

const mockUser = { id: 'user-1', displayName: 'Test User' };

function createRequest(url: string, options?: RequestInit) {
  return new NextRequest(new URL(url, 'https://test.swapify.app'), options as any);
}

describe('GET /api/spotify/search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue(mockUser as any);
    vi.mocked(getSession).mockResolvedValue({ activeCircleId: 'circle-1' } as any);
    vi.mocked(checkRateLimit).mockReturnValue(null);
  });

  it('returns 400 when no active circle is selected', async () => {
    vi.mocked(getSession).mockResolvedValue({ activeCircleId: undefined } as any);

    const request = createRequest('/api/spotify/search?q=test');
    const response = await GET(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('No active circle selected');
  });

  it('returns empty array for empty query', async () => {
    const request = createRequest('/api/spotify/search?q=');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.tracks).toEqual([]);
  });

  it('returns formatted tracks for valid query', async () => {
    const mockTrack = {
      id: 'track-1',
      uri: 'spotify:track:track-1',
      name: 'Test Song',
      duration_ms: 210000,
      artists: [{ id: 'artist-1', name: 'Test Artist' }],
      album: {
        id: 'album-1',
        name: 'Test Album',
        images: [{ url: 'https://img.spotify.com/album.jpg', height: 300, width: 300 }],
      },
      external_urls: { spotify: 'https://open.spotify.com/track/track-1' },
    };

    vi.mocked(searchTracks).mockResolvedValue([mockTrack] as any);

    const request = createRequest('/api/spotify/search?q=test+song');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.tracks).toHaveLength(1);
    expect(data.tracks[0]).toEqual({
      id: 'track-1',
      uri: 'spotify:track:track-1',
      name: 'Test Song',
      duration_ms: 210000,
      artists: [{ id: 'artist-1', name: 'Test Artist' }],
      album: {
        id: 'album-1',
        name: 'Test Album',
        images: [{ url: 'https://img.spotify.com/album.jpg', height: 300, width: 300 }],
      },
      external_urls: { spotify: 'https://open.spotify.com/track/track-1' },
    });

    expect(searchTracks).toHaveBeenCalledWith('user-1', 'circle-1', 'test song');
  });

  it('returns rate-limited response when checkRateLimit returns a 429', async () => {
    vi.mocked(checkRateLimit).mockReturnValue(
      NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    );

    const request = createRequest('/api/spotify/search?q=test');
    const response = await GET(request);

    expect(response.status).toBe(429);
    const data = await response.json();
    expect(data.error).toBe('Too many requests');
  });
});
