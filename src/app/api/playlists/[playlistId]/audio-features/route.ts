import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { db } from '@/db';
import { playlists, playlistMembers, playlistTracks } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { getAudioFeatures, SpotifyRateLimitError } from '@/lib/spotify';

// GET /api/playlists/[playlistId]/audio-features — energy scores for active tracks
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ playlistId: string }> }
) {
  const user = await requireAuth();
  const { playlistId } = await params;

  const limited = checkRateLimit(`api:${user.id}`, RATE_LIMITS.api);
  if (limited) return limited;

  // Verify membership
  const membership = await db.query.playlistMembers.findFirst({
    where: and(eq(playlistMembers.playlistId, playlistId), eq(playlistMembers.userId, user.id)),
  });
  if (!membership) {
    return NextResponse.json({ error: 'Not a member' }, { status: 403 });
  }

  // Get playlist for owner info
  const playlist = await db.query.playlists.findFirst({
    where: eq(playlists.id, playlistId),
  });
  if (!playlist) {
    return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });
  }

  // Get active track IDs
  const activeTracks = await db.query.playlistTracks.findMany({
    where: and(eq(playlistTracks.playlistId, playlistId), isNull(playlistTracks.removedAt)),
    columns: { spotifyTrackId: true },
  });

  const trackIds = activeTracks.map((t) => t.spotifyTrackId);
  if (trackIds.length === 0) {
    return NextResponse.json({ energyScores: {} });
  }

  // Fetch energy from Spotify using the owner's token
  try {
    const energyScores = await getAudioFeatures(playlist.ownerId, playlist.circleId, trackIds);

    return NextResponse.json({ energyScores });
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
