import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { jams, jamMembers, jamTracks } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { getPlaylistItems } from "@/lib/spotify";
import { generateId } from "@/lib/utils";

// POST /api/jams/[jamId]/tracks/sync — sync playlist items from Spotify
export async function POST(
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

  const jam = await db.query.jams.findFirst({
    where: eq(jams.id, jamId),
  });
  if (!jam) {
    return NextResponse.json({ error: "Jam not found" }, { status: 404 });
  }

  // Fetch current playlist items from Spotify
  const spotifyItems = await getPlaylistItems(
    jam.ownerId,
    jam.spotifyPlaylistId
  );

  // Get our active tracks
  const localTracks = await db.query.jamTracks.findMany({
    where: and(eq(jamTracks.jamId, jamId), isNull(jamTracks.removedAt)),
  });

  const localTrackUris = new Set(localTracks.map((t) => t.spotifyTrackUri));
  const spotifyTrackUris = new Set(
    spotifyItems.map((i) => i.item.uri)
  );

  // Add tracks that are on Spotify but not in our DB
  let added = 0;
  for (const spotifyItem of spotifyItems) {
    const track = spotifyItem.item;
    if (localTrackUris.has(track.uri)) continue;

    try {
      await db.insert(jamTracks).values({
        id: generateId(),
        jamId,
        spotifyTrackUri: track.uri,
        spotifyTrackId: track.id,
        trackName: track.name,
        artistName: track.artists.map((a) => a.name).join(", "),
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
        .update(jamTracks)
        .set({ removedAt: new Date() })
        .where(eq(jamTracks.id, localTrack.id));
      removed++;
    }
  }

  // Auto-sort playlist by vibe if new tracks were added (fire-and-forget)
  if (added > 0) {
    import("@/lib/vibe-sort").then(({ vibeSort }) => {
      vibeSort(jamId).catch(() => {});
    });
  }

  return NextResponse.json({ added, removed });
}
