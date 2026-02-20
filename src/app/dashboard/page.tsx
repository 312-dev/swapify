import { Suspense } from 'react';
import { requireVerifiedEmail, getSession, getUserCircles } from '@/lib/auth';
import { db } from '@/db';
import {
  playlists as playlistsTable,
  playlistMembers,
  trackListens,
  trackReactions,
} from '@/db/schema';
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

  // Fetch ALL playlists in the active circle (for discoverability)
  const circlePlaylistsList = activeCircleId
    ? await db.query.playlists.findMany({
        where: eq(playlistsTable.circleId, activeCircleId),
        with: {
          members: { with: { user: true } },
          tracks: true,
        },
      })
    : [];

  const memberPlaylistIds = new Set(filteredMemberships.map((m) => m.playlist.id));

  const likedCountMap = new Map(likedCounts.map((r) => [r.playlistId, r.count]));

  // Build a set of "playlistId:spotifyTrackId" the user has listened to
  const listenedSet = new Set(userListens.map((l) => `${l.playlistId}:${l.spotifyTrackId}`));

  const myPlaylists = filteredMemberships.map((m) => {
    const activeTracks = m.playlist.tracks.filter((t) => !t.removedAt);
    // Unplayed = active tracks NOT added by user AND not yet listened to
    const unplayedCount = activeTracks.filter(
      (t) => t.addedByUserId !== user.id && !listenedSet.has(`${m.playlist.id}:${t.spotifyTrackId}`)
    ).length;

    // Last updated = most recent track addedAt, or playlist createdAt as fallback
    const lastTrackDate = activeTracks.reduce<Date | null>((latest, t) => {
      const d = t.addedAt;
      return !latest || d > latest ? d : latest;
    }, null);
    const lastUpdatedAt = (lastTrackDate ?? m.playlist.createdAt).toISOString();

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
      lastUpdatedAt,
      isMember: true as const,
      members: m.playlist.members.map((mem) => ({
        id: mem.user.id,
        displayName: mem.user.displayName,
        avatarUrl: mem.user.avatarUrl,
      })),
    };
  });

  // Circle playlists the user hasn't joined yet
  const otherPlaylists = circlePlaylistsList
    .filter((p) => !memberPlaylistIds.has(p.id))
    .map((p) => {
      const activeTracks = p.tracks.filter((t) => !t.removedAt);
      const lastTrackDate = activeTracks.reduce<Date | null>((latest, t) => {
        const d = t.addedAt;
        return !latest || d > latest ? d : latest;
      }, null);
      const lastUpdatedAt = (lastTrackDate ?? p.createdAt).toISOString();

      return {
        id: p.id,
        name: p.name,
        description: p.description,
        imageUrl: p.imageUrl,
        vibeName: p.vibeName,
        memberCount: p.members.length,
        activeTrackCount: activeTracks.length,
        totalTrackCount: p.tracks.length,
        likedTrackCount: 0,
        unplayedCount: 0,
        lastUpdatedAt,
        isMember: false as const,
        members: p.members.map((mem) => ({
          id: mem.user.id,
          displayName: mem.user.displayName,
          avatarUrl: mem.user.avatarUrl,
        })),
      };
    });

  const playlists = [...myPlaylists, ...otherPlaylists];

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
