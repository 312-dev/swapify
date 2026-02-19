import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/db';
import { playlists, playlistMembers, playlistTracks } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { getPlaylistItems } from '@/lib/spotify';
import { generateId } from '@/lib/utils';

// POST /api/playlists/[playlistId]/tracks/sync — sync playlist items from Spotify
export async function POST(
  _request: NextRequest,
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

  // Fetch current playlist items from Spotify
  const spotifyItems = await getPlaylistItems(playlist.ownerId, playlist.spotifyPlaylistId);

  // Get our active tracks
  const localTracks = await db.query.playlistTracks.findMany({
    where: and(eq(playlistTracks.playlistId, playlistId), isNull(playlistTracks.removedAt)),
  });

  const localTrackUris = new Set(localTracks.map((t) => t.spotifyTrackUri));
  const spotifyTrackUris = new Set(spotifyItems.map((i) => i.track.uri));

  // Add tracks that are on Spotify but not in our DB
  let added = 0;
  for (const spotifyItem of spotifyItems) {
    const track = spotifyItem.track;
    if (localTrackUris.has(track.uri)) continue;

    try {
      await db.insert(playlistTracks).values({
        id: generateId(),
        playlistId: playlistId,
        spotifyTrackUri: track.uri,
        spotifyTrackId: track.id,
        trackName: track.name,
        artistName: track.artists.map((a) => a.name).join(', '),
        albumName: track.album?.name || null,
        albumImageUrl: track.album?.images?.[0]?.url || null,
        durationMs: track.duration_ms || null,
        addedByUserId: user.id,
      });
      added++;
    } catch {
      // Unique constraint — skip
    }
  }

  // Mark tracks as removed if they're no longer on the Spotify playlist
  let removed = 0;
  for (const localTrack of localTracks) {
    if (!spotifyTrackUris.has(localTrack.spotifyTrackUri)) {
      await db
        .update(playlistTracks)
        .set({ removedAt: new Date() })
        .where(eq(playlistTracks.id, localTrack.id));
      removed++;
    }
  }

  // Auto-sort playlist by vibe if new tracks were added (fire-and-forget)
  if (added > 0) {
    import('@/lib/vibe-sort').then(({ vibeSort }) => {
      vibeSort(playlistId).catch(() => {});
    });
  }

  return NextResponse.json({ added, removed });
}
