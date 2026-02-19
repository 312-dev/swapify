import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/db';
import { playlists, playlistMembers } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { followPlaylist } from '@/lib/spotify';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

// POST /api/playlists/[playlistId]/follow — follow the Spotify playlist
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ playlistId: string }> }
) {
  const user = await requireAuth();
  const { playlistId } = await params;

  const rateLimited = checkRateLimit(user.id, RATE_LIMITS.mutation);
  if (rateLimited) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  // Verify membership
  const membership = await db.query.playlistMembers.findFirst({
    where: and(eq(playlistMembers.playlistId, playlistId), eq(playlistMembers.userId, user.id)),
  });
  if (!membership) {
    return NextResponse.json({ error: 'Not a member' }, { status: 403 });
  }

  const playlist = await db.query.playlists.findFirst({
    where: eq(playlists.id, playlistId),
  });
  if (!playlist) {
    return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });
  }

  try {
    await followPlaylist(user.id, playlist.circleId, playlist.spotifyPlaylistId);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to follow playlist' },
      { status: 500 }
    );
  }

  // Notify existing members (fire-and-forget)
  import('@/lib/notifications').then(({ notifyPlaylistMembers }) => {
    notifyPlaylistMembers(
      playlistId,
      user.id,
      {
        title: 'Member followed playlist',
        body: `${user.displayName} followed "${playlist.name}" on Spotify`,
        url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/playlist/${playlistId}`,
      },
      'playlistFollowed'
    );
  });

  return NextResponse.json({ success: true });
}
