import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/db';
import { playlists, playlistMembers, playlistTracks } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { getPlaylistItems, getPlaylistDetails, TokenInvalidError } from '@/lib/spotify';
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

  // Fetch playlist metadata + items from Spotify in parallel
  let spotifyDetails;
  let spotifyItems;
  try {
    [spotifyDetails, spotifyItems] = await Promise.all([
      getPlaylistDetails(playlist.ownerId, playlist.circleId, playlist.spotifyPlaylistId),
      getPlaylistItems(playlist.ownerId, playlist.circleId, playlist.spotifyPlaylistId),
    ]);
  } catch (err) {
    if (err instanceof TokenInvalidError) {
      return NextResponse.json(
        { error: 'Your Spotify session has expired. Please reconnect.', needsReauth: true },
        { status: 401 }
      );
    }
    throw err;
  }

  // Check if metadata changed on Spotify and update local DB
  const metadataChanges: { name?: string; description?: string | null; imageUrl?: string | null } =
    {};

  if (spotifyDetails.name !== playlist.name) {
    metadataChanges.name = spotifyDetails.name;
  }
  // Only overwrite description if Spotify has a non-empty value that differs
  // (prevents Spotify's delayed processing from nulling out a just-set description)
  if (spotifyDetails.description && spotifyDetails.description !== playlist.description) {
    metadataChanges.description = spotifyDetails.description;
  }
  // Always prefer Spotify's CDN URL over a local data URL
  if (spotifyDetails.imageUrl && spotifyDetails.imageUrl !== playlist.imageUrl) {
    metadataChanges.imageUrl = spotifyDetails.imageUrl;
  }

  if (Object.keys(metadataChanges).length > 0) {
    await db.update(playlists).set(metadataChanges).where(eq(playlists.id, playlistId));
  }

  // Get our active tracks
  const localTracks = await db.query.playlistTracks.findMany({
    where: and(eq(playlistTracks.playlistId, playlistId), isNull(playlistTracks.removedAt)),
  });

  const localTrackUris = new Set(localTracks.map((t) => t.spotifyTrackUri));
  const spotifyTrackUris = new Set(spotifyItems.map((i) => i.item.uri));

  // Add tracks that are on Spotify but not in our DB
  let added = 0;
  for (const spotifyItem of spotifyItems) {
    const track = spotifyItem.item;
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

  // Auto-sort playlist tracks if tracks changed (fire-and-forget)
  if (added > 0 || removed > 0) {
    import('@/lib/playlist-sort').then(({ sortPlaylistTracks }) => {
      sortPlaylistTracks(playlistId).catch(() => {});
    });
  }

  return NextResponse.json({
    added,
    removed,
    ...(Object.keys(metadataChanges).length > 0 && { metadata: metadataChanges }),
  });
}
