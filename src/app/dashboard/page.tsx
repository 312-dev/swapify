import { requireAuth } from '@/lib/auth';
import { db } from '@/db';
import { playlistMembers, trackListens, trackReactions } from '@/db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import DashboardClient from './DashboardClient';

export default async function DashboardPage() {
  const user = await requireAuth();

  const [memberships, userListens, likedCounts] = await Promise.all([
    db.query.playlistMembers.findMany({
      where: eq(playlistMembers.userId, user.id),
      with: {
        playlist: {
          with: {
            members: { with: { user: true } },
            tracks: true,
          },
        },
      },
      orderBy: desc(playlistMembers.joinedAt),
    }),
    db.query.trackListens.findMany({
      where: eq(trackListens.userId, user.id),
    }),
    db
      .select({
        playlistId: trackReactions.playlistId,
        count: sql<number>`count(distinct ${trackReactions.spotifyTrackId})`,
      })
      .from(trackReactions)
      .where(and(eq(trackReactions.userId, user.id), eq(trackReactions.reaction, 'thumbs_up')))
      .groupBy(trackReactions.playlistId),
  ]);

  const likedCountMap = new Map(likedCounts.map((r) => [r.playlistId, r.count]));

  // Build a set of "playlistId:spotifyTrackId" the user has listened to
  const listenedSet = new Set(userListens.map((l) => `${l.playlistId}:${l.spotifyTrackId}`));

  const playlists = memberships.map((m) => {
    const activeTracks = m.playlist.tracks.filter((t) => !t.removedAt);
    // Unplayed = active tracks NOT added by user AND not yet listened to
    const unplayedCount = activeTracks.filter(
      (t) => t.addedByUserId !== user.id && !listenedSet.has(`${m.playlist.id}:${t.spotifyTrackId}`)
    ).length;

    return {
      id: m.playlist.id,
      name: m.playlist.name,
      description: m.playlist.description,
      imageUrl: m.playlist.imageUrl,
      vibeName: m.playlist.vibeName,
      memberCount: m.playlist.members.length,
      activeTrackCount: activeTracks.length,
      totalTrackCount: m.playlist.tracks.length,
      likedTrackCount: likedCountMap.get(m.playlist.id) ?? 0,
      unplayedCount,
      members: m.playlist.members.map((mem) => ({
        id: mem.user.id,
        displayName: mem.user.displayName,
        avatarUrl: mem.user.avatarUrl,
      })),
    };
  });

  return (
    <DashboardClient
      playlists={playlists}
      userName={user.displayName}
      notifyPush={user.notifyPush}
    />
  );
}
