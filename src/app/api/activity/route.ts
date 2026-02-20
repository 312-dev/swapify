import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import {
  playlistMembers,
  playlistTracks,
  trackReactions,
  playlists,
  circles,
  circleMembers,
} from '@/db/schema';
import { eq, desc, inArray, and, ne, isNull, isNotNull, gte } from 'drizzle-orm';

export type ActivityEventType =
  | 'track_added'
  | 'reaction'
  | 'member_joined'
  | 'track_removed'
  | 'swaplist_created'
  | 'circle_joined'
  | 'circle_created';

export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  timestamp: string;
  user: { displayName: string; avatarUrl: string | null };
  data: {
    trackName?: string;
    artistName?: string;
    albumImageUrl?: string | null;
    playlistName?: string;
    playlistId?: string;
    reaction?: string;
    circleName?: string;
  };
}

const REACTION_EMOJI: Record<string, string> = {
  thumbs_up: '\uD83D\uDC4D',
  thumbs_down: '\uD83D\uDC4E',
  fire: '\uD83D\uDD25',
  heart: '\u2764\uFE0F',
};

export function reactionToEmoji(reaction: string): string {
  return REACTION_EMOJI[reaction] ?? reaction;
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') ?? '20', 10) || 20, 50);

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Get user's playlist IDs and circle IDs in parallel
  const [membershipRows, circleMembershipRows] = await Promise.all([
    db.query.playlistMembers.findMany({
      where: eq(playlistMembers.userId, user.id),
    }),
    db.query.circleMembers.findMany({
      where: eq(circleMembers.userId, user.id),
    }),
  ]);

  const playlistIds = membershipRows.map((m) => m.playlistId);
  const circleIds = circleMembershipRows.map((m) => m.circleId);

  // Run all event type queries in parallel
  const [
    trackAddedRows,
    reactionRows,
    memberJoinedRows,
    trackRemovedRows,
    swaplistCreatedRows,
    circleJoinedRows,
    circleCreatedRows,
  ] = await Promise.all([
    // 1. Track added
    playlistIds.length > 0
      ? db.query.playlistTracks.findMany({
          where: and(
            inArray(playlistTracks.playlistId, playlistIds),
            isNull(playlistTracks.removedAt),
            ne(playlistTracks.addedByUserId, user.id),
            gte(playlistTracks.addedAt, sevenDaysAgo)
          ),
          with: { addedBy: true, playlist: true },
          orderBy: desc(playlistTracks.addedAt),
          limit: 10,
        })
      : Promise.resolve([]),

    // 2. Reactions (on tracks in user's playlists, by others)
    playlistIds.length > 0
      ? db.query.trackReactions.findMany({
          where: and(
            inArray(trackReactions.playlistId, playlistIds),
            ne(trackReactions.userId, user.id),
            gte(trackReactions.createdAt, sevenDaysAgo)
          ),
          with: { user: true, playlist: true },
          orderBy: desc(trackReactions.createdAt),
          limit: 10,
        })
      : Promise.resolve([]),

    // 3. Member joined playlist
    playlistIds.length > 0
      ? db.query.playlistMembers.findMany({
          where: and(
            inArray(playlistMembers.playlistId, playlistIds),
            ne(playlistMembers.userId, user.id),
            gte(playlistMembers.joinedAt, sevenDaysAgo)
          ),
          with: { user: true, playlist: true },
          orderBy: desc(playlistMembers.joinedAt),
          limit: 10,
        })
      : Promise.resolve([]),

    // 4. Track removed
    playlistIds.length > 0
      ? db.query.playlistTracks.findMany({
          where: and(
            inArray(playlistTracks.playlistId, playlistIds),
            isNotNull(playlistTracks.removedAt),
            gte(playlistTracks.removedAt, sevenDaysAgo)
          ),
          with: { addedBy: true, playlist: true },
          orderBy: desc(playlistTracks.removedAt),
          limit: 10,
        })
      : Promise.resolve([]),

    // 5. Swaplist created (in user's circles, by others)
    circleIds.length > 0
      ? db.query.playlists.findMany({
          where: and(
            inArray(playlists.circleId, circleIds),
            ne(playlists.ownerId, user.id),
            gte(playlists.createdAt, sevenDaysAgo)
          ),
          with: { owner: true },
          orderBy: desc(playlists.createdAt),
          limit: 10,
        })
      : Promise.resolve([]),

    // 6. Circle joined (in user's circles, by others)
    circleIds.length > 0
      ? db.query.circleMembers.findMany({
          where: and(
            inArray(circleMembers.circleId, circleIds),
            ne(circleMembers.userId, user.id),
            gte(circleMembers.joinedAt, sevenDaysAgo)
          ),
          with: { user: true, circle: true },
          orderBy: desc(circleMembers.joinedAt),
          limit: 10,
        })
      : Promise.resolve([]),

    // 7. Circle created (user's own circles — always included so feed is never empty)
    db.query.circles.findMany({
      where: eq(circles.hostUserId, user.id),
      with: { host: true },
      orderBy: desc(circles.createdAt),
      limit: 5,
    }),
  ]);

  // For reactions, we need track names. Build a lookup from spotifyTrackId -> track info
  const reactionTrackIds = reactionRows.map((r) => r.spotifyTrackId);
  let trackLookup = new Map<
    string,
    { trackName: string; artistName: string; albumImageUrl: string | null }
  >();
  if (reactionTrackIds.length > 0) {
    const trackRows = await db
      .select({
        spotifyTrackId: playlistTracks.spotifyTrackId,
        trackName: playlistTracks.trackName,
        artistName: playlistTracks.artistName,
        albumImageUrl: playlistTracks.albumImageUrl,
      })
      .from(playlistTracks)
      .where(
        and(
          inArray(playlistTracks.spotifyTrackId, reactionTrackIds),
          inArray(playlistTracks.playlistId, playlistIds)
        )
      )
      .groupBy(
        playlistTracks.spotifyTrackId,
        playlistTracks.trackName,
        playlistTracks.artistName,
        playlistTracks.albumImageUrl
      );
    trackLookup = new Map(trackRows.map((t) => [t.spotifyTrackId, t]));
  }

  // Map all rows into unified ActivityEvent[]
  const events: ActivityEvent[] = [];

  for (const t of trackAddedRows) {
    events.push({
      id: `ta-${t.id}`,
      type: 'track_added',
      timestamp: t.addedAt.toISOString(),
      user: { displayName: t.addedBy.displayName, avatarUrl: t.addedBy.avatarUrl },
      data: {
        trackName: t.trackName,
        artistName: t.artistName,
        albumImageUrl: t.albumImageUrl,
        playlistName: t.playlist.name,
        playlistId: t.playlist.id,
      },
    });
  }

  for (const r of reactionRows) {
    const track = trackLookup.get(r.spotifyTrackId);
    events.push({
      id: `rx-${r.id}`,
      type: 'reaction',
      timestamp: r.createdAt.toISOString(),
      user: { displayName: r.user.displayName, avatarUrl: r.user.avatarUrl },
      data: {
        trackName: track?.trackName,
        artistName: track?.artistName,
        albumImageUrl: track?.albumImageUrl,
        playlistName: r.playlist.name,
        playlistId: r.playlist.id,
        reaction: r.reaction,
      },
    });
  }

  for (const m of memberJoinedRows) {
    events.push({
      id: `mj-${m.id}`,
      type: 'member_joined',
      timestamp: m.joinedAt.toISOString(),
      user: { displayName: m.user.displayName, avatarUrl: m.user.avatarUrl },
      data: {
        playlistName: m.playlist.name,
        playlistId: m.playlist.id,
      },
    });
  }

  for (const t of trackRemovedRows) {
    events.push({
      id: `tr-${t.id}`,
      type: 'track_removed',
      timestamp: t.removedAt!.toISOString(),
      user: { displayName: t.addedBy.displayName, avatarUrl: t.addedBy.avatarUrl },
      data: {
        trackName: t.trackName,
        artistName: t.artistName,
        albumImageUrl: t.albumImageUrl,
        playlistName: t.playlist.name,
        playlistId: t.playlist.id,
      },
    });
  }

  for (const p of swaplistCreatedRows) {
    events.push({
      id: `sc-${p.id}`,
      type: 'swaplist_created',
      timestamp: p.createdAt.toISOString(),
      user: { displayName: p.owner.displayName, avatarUrl: p.owner.avatarUrl },
      data: {
        playlistName: p.name,
        playlistId: p.id,
      },
    });
  }

  for (const c of circleJoinedRows) {
    events.push({
      id: `cj-${c.id}`,
      type: 'circle_joined',
      timestamp: c.joinedAt.toISOString(),
      user: { displayName: c.user.displayName, avatarUrl: c.user.avatarUrl },
      data: {
        circleName: c.circle.name,
      },
    });
  }

  for (const c of circleCreatedRows) {
    events.push({
      id: `cc-${c.id}`,
      type: 'circle_created',
      timestamp: c.createdAt.toISOString(),
      user: { displayName: c.host.displayName, avatarUrl: c.host.avatarUrl },
      data: {
        circleName: c.name,
      },
    });
  }

  // Sort by timestamp descending, limit
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return NextResponse.json({ events: events.slice(0, limit) });
}
