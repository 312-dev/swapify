import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/db';
import { playlists, playlistMembers, playlistTracks, trackReactions } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import {
  createPlaylist,
  addItemsToPlaylist,
  getPlaylistDetails,
  TokenInvalidError,
} from '@/lib/spotify';

// POST /api/playlists/[playlistId]/liked-playlist — create or sync liked Spotify playlist
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

  // If user already has a liked playlist, verify it still exists
  if (membership.likedPlaylistId) {
    try {
      await getPlaylistDetails(user.id, playlist.circleId, membership.likedPlaylistId);
      // Playlist exists — return it
      return NextResponse.json({
        spotifyPlaylistId: membership.likedPlaylistId,
        spotifyPlaylistUrl: `https://open.spotify.com/playlist/${membership.likedPlaylistId}`,
      });
    } catch {
      // Playlist was deleted — clear and recreate
      await db
        .update(playlistMembers)
        .set({ likedPlaylistId: null })
        .where(eq(playlistMembers.id, membership.id));
    }
  }

  // Create new Spotify playlist under this user's account
  let spotifyPlaylist;
  try {
    spotifyPlaylist = await createPlaylist(
      user.id,
      playlist.circleId,
      `${playlist.name} Likes`,
      `Tracks I liked from ${playlist.name} on Swapify`,
      { collaborative: false }
    );
  } catch (err) {
    if (err instanceof TokenInvalidError) {
      return NextResponse.json(
        { error: 'Your Spotify session has expired. Please reconnect.', needsReauth: true },
        { status: 401 }
      );
    }
    throw err;
  }

  // Store on membership
  await db
    .update(playlistMembers)
    .set({ likedPlaylistId: spotifyPlaylist.id })
    .where(eq(playlistMembers.id, membership.id));

  // Initial population: get all liked track URIs
  const likedReactions = await db.query.trackReactions.findMany({
    where: and(
      eq(trackReactions.playlistId, playlistId),
      eq(trackReactions.userId, user.id),
      eq(trackReactions.reaction, 'thumbs_up')
    ),
  });

  if (likedReactions.length > 0) {
    const likedTrackIds = likedReactions.map((r) => r.spotifyTrackId);
    const tracks = await db.query.playlistTracks.findMany({
      where: eq(playlistTracks.playlistId, playlistId),
    });
    const uris = [
      ...new Set(
        tracks.filter((t) => likedTrackIds.includes(t.spotifyTrackId)).map((t) => t.spotifyTrackUri)
      ),
    ];
    if (uris.length > 0) {
      try {
        for (let i = 0; i < uris.length; i += 100) {
          await addItemsToPlaylist(
            user.id,
            playlist.circleId,
            spotifyPlaylist.id,
            uris.slice(i, i + 100)
          );
        }
      } catch (err) {
        if (err instanceof TokenInvalidError) {
          return NextResponse.json(
            { error: 'Your Spotify session has expired. Please reconnect.', needsReauth: true },
            { status: 401 }
          );
        }
        throw err;
      }
    }
  }

  return NextResponse.json({
    spotifyPlaylistId: spotifyPlaylist.id,
    spotifyPlaylistUrl: `https://open.spotify.com/playlist/${spotifyPlaylist.id}`,
  });
}

// DELETE /api/playlists/[playlistId]/liked-playlist — stop syncing
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ playlistId: string }> }
) {
  const user = await requireAuth();
  const { playlistId } = await params;

  const membership = await db.query.playlistMembers.findFirst({
    where: and(eq(playlistMembers.playlistId, playlistId), eq(playlistMembers.userId, user.id)),
  });
  if (!membership) {
    return NextResponse.json({ error: 'Not a member' }, { status: 403 });
  }

  await db
    .update(playlistMembers)
    .set({ likedPlaylistId: null })
    .where(eq(playlistMembers.id, membership.id));

  return NextResponse.json({ success: true });
}
