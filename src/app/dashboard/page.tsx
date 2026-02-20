import { Suspense } from 'react';
import { requireVerifiedEmail, getSession, getUserCircles } from '@/lib/auth';
import { db } from '@/db';
import { playlistMembers, trackListens, trackReactions } from '@/db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import DashboardClient from './DashboardClient';

export default async function DashboardPage() {
  const user = await requireVerifiedEmail();
  const session = await getSession();

  // Pre-fetch circles to auto-default if needed
  const userCircles = await getUserCircles(user.id);

  // Auto-default: if user has circles but none active, use the first one for this render.
  // The client will persist this via /api/circles/switch on mount.
  let activeCircleId = session.activeCircleId ?? null;
  let activeCircleName = session.activeCircleName ?? null;
  const needsCircleSync = !activeCircleId && userCircles.length > 0;
  if (needsCircleSync) {
    const first = userCircles[0]!;
    activeCircleId = first.circle.id;
    activeCircleName = first.circle.name;
  }

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

  // Filter memberships to active circle if one is set
  const filteredMemberships = memberships.filter(
    (m) => !activeCircleId || m.playlist.circleId === activeCircleId
  );

  const likedCountMap = new Map(likedCounts.map((r) => [r.playlistId, r.count]));

  // Build a set of "playlistId:spotifyTrackId" the user has listened to
  const listenedSet = new Set(userListens.map((l) => `${l.playlistId}:${l.spotifyTrackId}`));

  const playlists = filteredMemberships.map((m) => {
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

  // Map circle memberships for the CircleSwitcher
  const circles = userCircles.map((cm) => ({
    id: cm.circle.id,
    name: cm.circle.name,
    imageUrl: cm.circle.imageUrl ?? null,
    spotifyClientId: cm.circle.spotifyClientId,
    inviteCode: cm.circle.inviteCode,
    maxMembers: cm.circle.maxMembers,
    role: cm.role,
    memberCount: cm.circle.members.length,
    members: cm.circle.members.map((m) => ({
      id: m.user.id,
      displayName: m.user.displayName,
      avatarUrl: m.user.avatarUrl ?? null,
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
    })),
  }));

  return (
    <Suspense>
      <DashboardClient
        playlists={playlists}
        userName={user.displayName}
        spotifyId={user.spotifyId}
        notifyPush={user.notifyPush}
        circles={circles}
        activeCircleId={activeCircleId}
        activeCircleName={activeCircleName}
        syncCircleId={needsCircleSync ? activeCircleId : null}
        hasCompletedTour={user.hasCompletedTour}
      />
    </Suspense>
  );
}
