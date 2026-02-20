import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getSession } from '@/lib/auth';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { searchTracks, SpotifyRateLimitError } from '@/lib/spotify';

// GET /api/spotify/search?q=...
export async function GET(request: NextRequest) {
  const user = await requireAuth();

  const session = await getSession();
  const circleId = session.activeCircleId;
  if (!circleId) {
    return NextResponse.json({ error: 'No active circle selected' }, { status: 400 });
  }

  const limited = checkRateLimit(`search:${user.id}`, RATE_LIMITS.search);
  if (limited) return limited;

  const query = request.nextUrl.searchParams.get('q');

  if (!query || query.trim().length === 0) {
    return NextResponse.json({ tracks: [] });
  }

  try {
    const tracks = await searchTracks(user.id, circleId, query.trim());

    return NextResponse.json({
      tracks: tracks.map((t) => ({
        id: t.id,
        uri: t.uri,
        name: t.name,
        duration_ms: t.duration_ms,
        artists: t.artists.map((a) => ({ id: a.id, name: a.name })),
        album: {
          id: t.album.id,
          name: t.album.name,
          images: t.album.images,
        },
        external_urls: t.external_urls,
      })),
    });
  } catch (err) {
    if (err instanceof SpotifyRateLimitError) {
      return NextResponse.json(
        {
          error: 'Spotify is a bit busy right now. Please try again in a minute.',
          rateLimited: true,
        },
        { status: 429 }
      );
    }
    throw err;
  }
}
