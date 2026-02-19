import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { jamMembers, jamTracks } from "@/db/schema";
import { eq, desc, inArray } from "drizzle-orm";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get user's jam IDs
  const memberships = await db.query.jamMembers.findMany({
    where: eq(jamMembers.userId, user.id),
  });
  const jamIds = memberships.map((m) => m.jamId);

  if (jamIds.length === 0) {
    return NextResponse.json({ events: [] });
  }

  // Get recent tracks added (last 50)
  const recentTracks = await db.query.jamTracks.findMany({
    where: inArray(jamTracks.jamId, jamIds),
    with: {
      addedBy: true,
      jam: true,
    },
    orderBy: desc(jamTracks.addedAt),
    limit: 50,
  });

  // Build activity events from track additions
  const events = recentTracks.map((track) => ({
    id: `track-${track.id}`,
    type: "track_added" as const,
    timestamp: track.addedAt,
    user: {
      displayName: track.addedBy.displayName,
      avatarUrl: track.addedBy.avatarUrl,
    },
    data: {
      trackName: track.trackName,
      artistName: track.artistName,
      albumImageUrl: track.albumImageUrl,
      jamName: track.jam.name,
      jamId: track.jam.id,
    },
  }));

  // Sort by timestamp descending
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return NextResponse.json({ events: events.slice(0, 30) });
}
