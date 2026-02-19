import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { db } from '@/db';
import {
  playlists,
  playlistMembers,
  playlistTracks,
  trackListens,
  trackReactions,
} from '@/db/schema';
import { eq, and, isNull, isNotNull, sql } from 'drizzle-orm';
import {
  addItemsToPlaylist,
  getPlaylistItems,
  checkSavedTracks,
  isRateLimited,
} from '@/lib/spotify';
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
    where: and(eq(playlistTracks.playlistId, playlistId), isNotNull(playlistTracks.removedAt)),
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

  // Parse active playback for each member (for "now listening" indicators)
  const PLAYBACK_FRESHNESS_MS = 90_000; // 90s = 3 poll cycles
  const now = Date.now();
  interface PlaybackInfo {
    trackId: string;
    progressMs: number;
    durationMs: number;
    capturedAt: number;
  }
  const memberPlayback = new Map<string, PlaybackInfo>(); // userId -> playback snapshot
  for (const m of members) {
    if (m.user.lastPlaybackJson) {
      try {
        const snap = JSON.parse(m.user.lastPlaybackJson) as PlaybackInfo;
        if (snap.trackId && now - snap.capturedAt < PLAYBACK_FRESHNESS_MS) {
          memberPlayback.set(m.user.id, snap);
        }
      } catch {
        // Invalid JSON, skip
      }
    }
  }

  const activeTracks = tracks.map((track) => {
    const requiredListeners = memberList.filter((m) => m.id !== track.addedByUserId);
    const trackListenRecords = listens.filter((l) => l.spotifyTrackId === track.spotifyTrackId);
    const trackReactionRecords = reactions.filter((r) => r.spotifyTrackId === track.spotifyTrackId);

    const progress = requiredListeners.map((member) => {
      const listen = trackListenRecords.find((l) => l.userId === member.id);
      const reaction = trackReactionRecords.find((r) => r.userId === member.id);
      return {
        ...member,
        hasListened: !!listen || !!reaction,
        listenedAt: listen?.listenedAt ?? reaction?.createdAt ?? null,
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
        isAuto: r.isAuto,
        createdAt: r.createdAt,
      })),
      activeListeners: memberList
        .filter((m) => {
          const snap = memberPlayback.get(m.id);
          if (!snap || snap.trackId !== track.spotifyTrackId) return false;
          // Estimate current position — stop showing if past track duration
          const estimatedMs = snap.progressMs + (now - snap.capturedAt);
          return estimatedMs < snap.durationMs;
        })
        .map((m) => {
          const snap = memberPlayback.get(m.id)!;
          return {
            ...m,
            progressMs: snap.progressMs,
            durationMs: snap.durationMs,
            capturedAt: snap.capturedAt,
          };
        }),
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

  // Liked tracks: all tracks where current user has thumbs_up reaction
  const userLikedTrackIds = new Set(
    reactions
      .filter((r) => r.userId === user.id && r.reaction === 'thumbs_up')
      .map((r) => r.spotifyTrackId)
  );

  const allDbTracks = [...tracks, ...removedTracks];
  const likedTracks = allDbTracks
    .filter((t) => userLikedTrackIds.has(t.spotifyTrackId))
    .map((track) => ({
      spotifyTrackId: track.spotifyTrackId,
      spotifyTrackUri: track.spotifyTrackUri,
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
      isActive: !track.removedAt,
    }));

  // Outcast tracks: removed tracks where current user does NOT have thumbs_up
  const outcastTracks = removedTracks
    .filter((t) => !userLikedTrackIds.has(t.spotifyTrackId))
    .map((track) => {
      const userReaction = reactions.find(
        (r) => r.userId === user.id && r.spotifyTrackId === track.spotifyTrackId
      );
      return {
        spotifyTrackId: track.spotifyTrackId,
        spotifyTrackUri: track.spotifyTrackUri,
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
        reaction: userReaction?.reaction ?? null,
      };
    });

  return NextResponse.json({
    tracks: activeTracks,
    previousTracks,
    members: memberList,
    likedTracks,
    outcastTracks,
    likedPlaylistId: membership.likedPlaylistId ?? null,
    vibeName: playlist?.vibeName ?? null,
  });
}

// POST /api/playlists/[playlistId]/tracks — add a track
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ playlistId: string }> }
) {
  const user = await requireAuth();

  const limited = checkRateLimit(`mutation:${user.id}`, RATE_LIMITS.mutation);
  if (limited) return limited;

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
      { error: 'Unable to add track to playlist. Please try again.' },
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
    notifyPlaylistMembers(
      playlistId,
      user.id,
      {
        title: 'New track added',
        body: `${user.displayName} added "${trackName}" by ${artistName}`,
        url: `${process.env.NEXT_PUBLIC_APP_URL}/playlist/${playlistId}`,
      },
      'newTrack'
    );
  });

  // Auto-sort playlist by vibe (fire-and-forget)
  import('@/lib/vibe-sort').then(({ vibeSort }) => {
    vibeSort(playlistId).catch(() => {});
  });

  // Auto-like: check if other members already have this track saved in their library
  (async () => {
    try {
      const { setAutoReaction } = await import('@/lib/polling');
      const otherMembers = (
        await db.query.playlistMembers.findMany({
          where: eq(playlistMembers.playlistId, playlistId),
        })
      ).filter((m) => m.userId !== user.id);

      for (const member of otherMembers) {
        if (isRateLimited()) break;
        try {
          const [isSaved] = await checkSavedTracks(member.userId, [spotifyTrackId]);
          if (isSaved) {
            await setAutoReaction(playlistId, spotifyTrackId, member.userId, 'thumbs_up');
          }
        } catch {
          // Token expired or rate limited — skip this member
        }
      }
    } catch (err) {
      console.error('[Swapify] Auto-like library check failed:', err);
    }
  })();

  return NextResponse.json({ id: trackId, success: true });
}
