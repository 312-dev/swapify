import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/db';
import { playlists, playlistMembers, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { checkFollowPlaylist } from '@/lib/spotify';

// GET /api/playlists/[playlistId]/follow-status — check if user follows on Spotify
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ playlistId: string }> }
) {
  const user = await requireAuth();
  const { playlistId } = await params;

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

  // Get user's Spotify ID
  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, user.id),
  });
  if (!dbUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  try {
    const isFollowing = await checkFollowPlaylist(
      user.id,
      playlist.circleId,
      playlist.spotifyPlaylistId,
      dbUser.spotifyId
    );
    return NextResponse.json({ isFollowing });
  } catch {
    // If Spotify check fails, assume following to avoid blocking the user
    return NextResponse.json({ isFollowing: true });
  }
}
