import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import {
  jams,
  jamMembers,
  jamTracks,
  trackListens,
  trackReactions,
  users,
} from "@/db/schema";
import { eq, and, isNull, inArray, sql } from "drizzle-orm";
import { addItemsToPlaylist, getPlaylistItems } from "@/lib/spotify";
import { generateId } from "@/lib/utils";

// GET /api/jams/[jamId]/tracks — tracks with listen progress + reactions
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jamId: string }> }
) {
  const user = await requireAuth();
  const { jamId } = await params;

  // Verify membership
  const membership = await db.query.jamMembers.findFirst({
    where: and(eq(jamMembers.jamId, jamId), eq(jamMembers.userId, user.id)),
  });
  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  // Get all members
  const members = await db.query.jamMembers.findMany({
    where: eq(jamMembers.jamId, jamId),
    with: { user: true },
  });

  // Get jam for Spotify playlist ID
  const jam = await db.query.jams.findFirst({
    where: eq(jams.id, jamId),
  });

  // Get active tracks from DB
  const dbTracks = await db.query.jamTracks.findMany({
    where: and(eq(jamTracks.jamId, jamId), isNull(jamTracks.removedAt)),
    with: { addedBy: true },
  });

  // Sort tracks to match Spotify playlist order
  let tracks = dbTracks;
  if (jam && dbTracks.length > 1) {
    try {
      const spotifyItems = await getPlaylistItems(jam.ownerId, jam.spotifyPlaylistId);
      const spotifyOrder = new Map(
        spotifyItems.map((item, i) => [item.item.uri, i])
      );
      tracks = [...dbTracks].sort((a, b) => {
        const posA = spotifyOrder.get(a.spotifyTrackUri) ?? Infinity;
        const posB = spotifyOrder.get(b.spotifyTrackUri) ?? Infinity;
        return posA - posB;
      });
    } catch {
      // Fall back to addedAt order if Spotify fetch fails
      tracks = dbTracks.sort((a, b) =>
        new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime()
      );
    }
  }

  // Get removed tracks (previously played)
  const removedTracks = await db.query.jamTracks.findMany({
    where: and(
      eq(jamTracks.jamId, jamId),
      // removedAt is NOT null
      eq(jamTracks.removedAt, jamTracks.removedAt) // trick: this is always true, need proper NOT NULL check
    ),
    with: { addedBy: true },
    orderBy: jamTracks.addedAt,
  });

  // Get all listens for this jam
  const listens = await db.query.trackListens.findMany({
    where: eq(trackListens.jamId, jamId),
    with: { user: true },
  });

  // Get all reactions for this jam
  const reactions = await db.query.trackReactions.findMany({
    where: eq(trackReactions.jamId, jamId),
    with: { user: true },
  });

  // Build track data with progress
  const memberList = members.map((m) => ({
    id: m.user.id,
    displayName: m.user.displayName,
    avatarUrl: m.user.avatarUrl,
  }));

  const activeTracks = tracks.map((track) => {
    const requiredListeners = memberList.filter(
      (m) => m.id !== track.addedByUserId
    );
    const trackListenRecords = listens.filter(
      (l) => l.spotifyTrackId === track.spotifyTrackId
    );
    const trackReactionRecords = reactions.filter(
      (r) => r.spotifyTrackId === track.spotifyTrackId
    );

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
  const previousTracks = removedTracks
    .filter((t) => t.removedAt)
    .map((track) => ({
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

// POST /api/jams/[jamId]/tracks — add a track
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jamId: string }> }
) {
  const user = await requireAuth();
  const { jamId } = await params;

  const membership = await db.query.jamMembers.findFirst({
    where: and(eq(jamMembers.jamId, jamId), eq(jamMembers.userId, user.id)),
  });
  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
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
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  // Check for duplicate active track
  const existing = await db.query.jamTracks.findFirst({
    where: and(
      eq(jamTracks.jamId, jamId),
      eq(jamTracks.spotifyTrackUri, spotifyTrackUri),
      isNull(jamTracks.removedAt)
    ),
  });
  if (existing) {
    return NextResponse.json(
      { error: "Track already in this Deep Dig" },
      { status: 409 }
    );
  }

  // Get jam to use owner's token for playlist mutation
  const jam = await db.query.jams.findFirst({
    where: eq(jams.id, jamId),
  });
  if (!jam) {
    return NextResponse.json({ error: "Jam not found" }, { status: 404 });
  }

  // Check per-user track limit
  if (jam.maxTracksPerUser !== null) {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(jamTracks)
      .where(
        and(
          eq(jamTracks.jamId, jamId),
          eq(jamTracks.addedByUserId, user.id),
          isNull(jamTracks.removedAt)
        )
      );

    if (count >= jam.maxTracksPerUser) {
      return NextResponse.json(
        {
          error: `You can only have ${jam.maxTracksPerUser} active track${jam.maxTracksPerUser === 1 ? "" : "s"} in this Deep Dig`,
        },
        { status: 400 }
      );
    }
  }

  // Add to Spotify playlist using owner's token
  await addItemsToPlaylist(jam.ownerId, jam.spotifyPlaylistId, [
    spotifyTrackUri,
  ]);

  // Add to our DB
  const trackId = generateId();
  await db.insert(jamTracks).values({
    id: trackId,
    jamId,
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
  import("@/lib/notifications").then(({ notifyJamMembers }) => {
    notifyJamMembers(jamId, user.id, {
      title: "New track added",
      body: `${user.displayName} added "${trackName}" by ${artistName}`,
      url: `${process.env.NEXT_PUBLIC_APP_URL}/jam/${jamId}`,
    });
  });

  // Auto-sort playlist by vibe (fire-and-forget)
  import("@/lib/vibe-sort").then(({ vibeSort }) => {
    vibeSort(jamId).catch(() => {});
  });

  return NextResponse.json({ id: trackId, success: true });
}
