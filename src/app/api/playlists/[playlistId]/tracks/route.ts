import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/db';
import {
  playlists,
  playlistMembers,
  playlistTracks,
  trackListens,
  trackReactions,
} from '@/db/schema';
import { eq, and, isNull, isNotNull, sql } from 'drizzle-orm';
import { addItemsToPlaylist, getPlaylistItems } from '@/lib/spotify';
import { generateId } from '@/lib/utils';

// GET /api/playlists/[playlistId]/tracks — tracks with listen progress + reactions
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

  // Get all members
  const members = await db.query.playlistMembers.findMany({
    where: eq(playlistMembers.playlistId, playlistId),
    with: { user: true },
  });

  // Get playlist for Spotify playlist ID
  const playlist = await db.query.playlists.findFirst({
    where: eq(playlists.id, playlistId),
  });

  // Get active tracks from DB
  const dbTracks = await db.query.playlistTracks.findMany({
    where: and(eq(playlistTracks.playlistId, playlistId), isNull(playlistTracks.removedAt)),
    with: { addedBy: true },
  });

  // Sort tracks to match Spotify playlist order
  let tracks = dbTracks;
  if (playlist && dbTracks.length > 1) {
    try {
      const spotifyItems = await getPlaylistItems(playlist.ownerId, playlist.spotifyPlaylistId);
      const spotifyOrder = new Map(spotifyItems.map((item, i) => [item.track.uri, i]));
      tracks = [...dbTracks].sort((a, b) => {
        const posA = spotifyOrder.get(a.spotifyTrackUri) ?? Infinity;
        const posB = spotifyOrder.get(b.spotifyTrackUri) ?? Infinity;
        return posA - posB;
      });
    } catch {
      // Fall back to addedAt order if Spotify fetch fails
      tracks = dbTracks.sort(
        (a, b) => new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime()
      );
    }
  }

  // Get removed tracks (previously played)
  const removedTracks = await db.query.playlistTracks.findMany({
    where: and(
      eq(playlistTracks.playlistId, playlistId),
      isNotNull(playlistTracks.removedAt)
    ),
    with: { addedBy: true },
    orderBy: playlistTracks.addedAt,
  });

  // Get all listens for this playlist
  const listens = await db.query.trackListens.findMany({
    where: eq(trackListens.playlistId, playlistId),
    with: { user: true },
  });

  // Get all reactions for this playlist
  const reactions = await db.query.trackReactions.findMany({
    where: eq(trackReactions.playlistId, playlistId),
    with: { user: true },
  });

  // Build track data with progress
  const memberList = members.map((m) => ({
    id: m.user.id,
    displayName: m.user.displayName,
    avatarUrl: m.user.avatarUrl,
  }));

  const activeTracks = tracks.map((track) => {
    const requiredListeners = memberList.filter((m) => m.id !== track.addedByUserId);
    const trackListenRecords = listens.filter((l) => l.spotifyTrackId === track.spotifyTrackId);
    const trackReactionRecords = reactions.filter((r) => r.spotifyTrackId === track.spotifyTrackId);

    const progress = requiredListeners.map((member) => {
      const listen = trackListenRecords.find((l) => l.userId === member.id);
      return {
        ...member,
        hasListened: !!listen,
        listenedAt: listen?.listenedAt ?? null,
      };
    });

    return {
      id: track.id,
      spotifyTrackId: track.spotifyTrackId,
      spotifyTrackUri: track.spotifyTrackUri,
      trackName: track.trackName,
      artistName: track.artistName,
      albumName: track.albumName,
      albumImageUrl: track.albumImageUrl,
      durationMs: track.durationMs,
      addedBy: {
        id: track.addedBy.id,
        displayName: track.addedBy.displayName,
        avatarUrl: track.addedBy.avatarUrl,
      },
      addedAt: track.addedAt,
      progress,
      listenedCount: progress.filter((p) => p.hasListened).length,
      totalRequired: requiredListeners.length,
      reactions: trackReactionRecords.map((r) => ({
        userId: r.userId,
        displayName: r.user.displayName,
        avatarUrl: r.user.avatarUrl,
        reaction: r.reaction,
        isAuto: !!r.isAuto,
        createdAt: r.createdAt,
      })),
    };
  });

  // Previously played tracks
  const previousTracks = removedTracks.map((track) => ({
      id: track.id,
      spotifyTrackId: track.spotifyTrackId,
      trackName: track.trackName,
      artistName: track.artistName,
      albumImageUrl: track.albumImageUrl,
      addedBy: {
        id: track.addedBy.id,
        displayName: track.addedBy.displayName,
        avatarUrl: track.addedBy.avatarUrl,
      },
      addedAt: track.addedAt,
      removedAt: track.removedAt,
      archivedAt: track.archivedAt,
    }));

  return NextResponse.json({
    tracks: activeTracks,
    previousTracks,
    members: memberList,
  });
}

// POST /api/playlists/[playlistId]/tracks — add a track
export async function POST(
  request: NextRequest,
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

  const body = await request.json();
  const {
    spotifyTrackUri,
    spotifyTrackId,
    trackName,
    artistName,
    albumName,
    albumImageUrl,
    durationMs,
  } = body;

  if (!spotifyTrackUri || !spotifyTrackId || !trackName || !artistName) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Check for duplicate active track
  const existing = await db.query.playlistTracks.findFirst({
    where: and(
      eq(playlistTracks.playlistId, playlistId),
      eq(playlistTracks.spotifyTrackUri, spotifyTrackUri),
      isNull(playlistTracks.removedAt)
    ),
  });
  if (existing) {
    return NextResponse.json({ error: 'Track already in this Swaplist' }, { status: 409 });
  }

  // Get playlist to use owner's token for playlist mutation
  const playlist = await db.query.playlists.findFirst({
    where: eq(playlists.id, playlistId),
  });
  if (!playlist) {
    return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });
  }

  // Check per-user track limit
  if (playlist.maxTracksPerUser !== null) {
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(playlistTracks)
      .where(
        and(
          eq(playlistTracks.playlistId, playlistId),
          eq(playlistTracks.addedByUserId, user.id),
          isNull(playlistTracks.removedAt)
        )
      );

    const count = countResult[0]?.count ?? 0;

    if (count >= playlist.maxTracksPerUser) {
      return NextResponse.json(
        {
          error: `You can only have ${playlist.maxTracksPerUser} active track${playlist.maxTracksPerUser === 1 ? '' : 's'} in this Swaplist`,
        },
        { status: 400 }
      );
    }
  }

  // Add to Spotify playlist using owner's token
  try {
    await addItemsToPlaylist(playlist.ownerId, playlist.spotifyPlaylistId, [spotifyTrackUri]);
  } catch (err) {
    console.error('Spotify addItemsToPlaylist failed:', err);
    return NextResponse.json(
      { error: `Spotify error: ${err instanceof Error ? err.message : 'unknown'}` },
      { status: 502 }
    );
  }

  // Add to our DB
  const trackId = generateId();
  await db.insert(playlistTracks).values({
    id: trackId,
    playlistId: playlistId,
    spotifyTrackUri,
    spotifyTrackId,
    trackName,
    artistName,
    albumName: albumName || null,
    albumImageUrl: albumImageUrl || null,
    durationMs: durationMs || null,
    addedByUserId: user.id,
  });

  // Notify other members
  import('@/lib/notifications').then(({ notifyPlaylistMembers }) => {
    notifyPlaylistMembers(playlistId, user.id, {
      title: 'New track added',
      body: `${user.displayName} added "${trackName}" by ${artistName}`,
      url: `${process.env.NEXT_PUBLIC_APP_URL}/playlist/${playlistId}`,
    });
  });

  // Auto-sort playlist by vibe (fire-and-forget)
  import('@/lib/vibe-sort').then(({ vibeSort }) => {
    vibeSort(playlistId).catch(() => {});
  });

  return NextResponse.json({ id: trackId, success: true });
}
