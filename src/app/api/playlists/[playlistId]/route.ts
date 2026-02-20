import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/db';
import { playlists, playlistMembers } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import {
  updatePlaylistDetails,
  uploadPlaylistImage,
  getPlaylistDetails,
  TokenInvalidError,
} from '@/lib/spotify';
import { VALID_REMOVAL_DELAYS, SORT_MODES, type SortMode } from '@/lib/utils';

// GET /api/playlists/[playlistId] — playlist detail
export async function GET(
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
    with: {
      owner: true,
      members: { with: { user: true } },
    },
  });

  if (!playlist) {
    return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });
  }

  return NextResponse.json({
    ...playlist,
    members: playlist.members.map((m) => ({
      id: m.user.id,
      displayName: m.user.displayName,
      avatarUrl: m.user.avatarUrl,
      joinedAt: m.joinedAt,
    })),
    isOwner: playlist.ownerId === user.id,
  });
}

// PATCH /api/playlists/[playlistId] — update playlist settings (owner only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ playlistId: string }> }
) {
  const user = await requireAuth();
  const { playlistId } = await params;

  const playlist = await db.query.playlists.findFirst({
    where: eq(playlists.id, playlistId),
  });
  if (!playlist) {
    return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });
  }
  if (playlist.ownerId !== user.id) {
    return NextResponse.json({ error: 'Not the owner' }, { status: 403 });
  }

  const body = await request.json();
  const {
    name,
    description,
    imageBase64,
    maxTracksPerUser,
    maxTrackAgeDays,
    removalDelay,
    sortMode,
  } = body;

  const updates: Partial<typeof playlists.$inferInsert> = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;

  // Handle max tracks per user
  if (maxTracksPerUser !== undefined) {
    if (maxTracksPerUser === null) {
      updates.maxTracksPerUser = null;
    } else {
      const parsed = Number.parseInt(maxTracksPerUser, 10);
      if (Number.isNaN(parsed) || parsed < 1 || parsed > 50) {
        return NextResponse.json({ error: 'Max tracks must be between 1 and 50' }, { status: 400 });
      }
      updates.maxTracksPerUser = parsed;
    }
  }

  // Handle max track age
  if (maxTrackAgeDays !== undefined) {
    const days = Number(maxTrackAgeDays);
    if (!Number.isInteger(days) || days < 0 || days > 365) {
      return NextResponse.json({ error: 'Max track age must be 0-365 days' }, { status: 400 });
    }
    updates.maxTrackAgeDays = days;
  }

  // Handle removal delay
  if (removalDelay !== undefined) {
    if (!VALID_REMOVAL_DELAYS.includes(removalDelay)) {
      return NextResponse.json({ error: 'Invalid removal delay' }, { status: 400 });
    }
    updates.removalDelay = removalDelay;
  }

  // Handle sort mode
  if (sortMode !== undefined) {
    if (!SORT_MODES.includes(sortMode as SortMode)) {
      return NextResponse.json({ error: 'Invalid sort mode' }, { status: 400 });
    }
    updates.sortMode = sortMode;
  }

  // Update Spotify playlist details
  const spotifyUpdates: { name?: string; description?: string } = {};
  if (name) spotifyUpdates.name = name;
  if (description !== undefined) spotifyUpdates.description = description;

  try {
    if (Object.keys(spotifyUpdates).length > 0) {
      await updatePlaylistDetails(
        user.id,
        playlist.circleId,
        playlist.spotifyPlaylistId,
        spotifyUpdates
      );
    }

    // Upload cover image if provided, then fetch the CDN URL from Spotify
    if (imageBase64) {
      await uploadPlaylistImage(
        user.id,
        playlist.circleId,
        playlist.spotifyPlaylistId,
        imageBase64
      );
      // Spotify processes the image async — fetch the CDN URL it generates
      const details = await getPlaylistDetails(
        user.id,
        playlist.circleId,
        playlist.spotifyPlaylistId
      );
      updates.imageUrl = details.imageUrl;
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

  if (Object.keys(updates).length > 0) {
    await db.update(playlists).set(updates).where(eq(playlists.id, playlistId));
  }

  // Re-sort tracks if sort mode changed (fire-and-forget)
  if (sortMode !== undefined && sortMode !== playlist.sortMode) {
    import('@/lib/playlist-sort').then(({ sortPlaylistTracks }) => {
      sortPlaylistTracks(playlistId).catch(() => {});
    });
  }

  const updated = await db.query.playlists.findFirst({
    where: eq(playlists.id, playlistId),
    with: { owner: true, members: { with: { user: true } } },
  });

  return NextResponse.json(updated);
}

// DELETE /api/playlists/[playlistId] — delete playlist (owner only)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ playlistId: string }> }
) {
  const user = await requireAuth();
  const { playlistId } = await params;

  const playlist = await db.query.playlists.findFirst({
    where: eq(playlists.id, playlistId),
  });
  if (!playlist) {
    return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });
  }
  if (playlist.ownerId !== user.id) {
    return NextResponse.json({ error: 'Not the owner' }, { status: 403 });
  }

  // Cascade delete handles members, tracks, listens
  await db.delete(playlists).where(eq(playlists.id, playlistId));

  return NextResponse.json({ success: true });
}
