import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { jams, jamMembers, jamTracks, users } from "@/db/schema";
import { eq, desc, and, isNull, sql } from "drizzle-orm";
import { createPlaylist, updatePlaylistDetails } from "@/lib/spotify";
import { generateId, generateInviteCode, getFirstName, formatDigName } from "@/lib/utils";

// GET /api/jams — list user's jams
export async function GET() {
  const user = await requireAuth();

  const memberships = await db.query.jamMembers.findMany({
    where: eq(jamMembers.userId, user.id),
    with: {
      jam: {
        with: {
          owner: true,
          members: { with: { user: true } },
          tracks: true,
        },
      },
    },
    orderBy: desc(jamMembers.joinedAt),
  });

  const result = memberships.map((m) => ({
    ...m.jam,
    memberCount: m.jam.members.length,
    activeTrackCount: m.jam.tracks.filter((t) => !t.removedAt).length,
    members: m.jam.members.map((mem) => ({
      id: mem.user.id,
      displayName: mem.user.displayName,
      avatarUrl: mem.user.avatarUrl,
    })),
  }));

  return NextResponse.json(result);
}

// POST /api/jams — create a new Deep Dig
export async function POST(request: NextRequest) {
  const user = await requireAuth();
  const body = await request.json();
  const { name, description } = body;

  const defaultName = name || formatDigName([getFirstName(user.displayName)]);
  const jamId = generateId();
  const inviteCode = generateInviteCode();

  // Create Spotify playlist
  const playlist = await createPlaylist(user.id, defaultName, description);

  // Insert jam
  await db.insert(jams).values({
    id: jamId,
    name: defaultName,
    description: description || null,
    spotifyPlaylistId: playlist.id,
    ownerId: user.id,
    inviteCode,
  });

  // Owner auto-joins
  await db.insert(jamMembers).values({
    id: generateId(),
    jamId,
    userId: user.id,
  });

  const jam = await db.query.jams.findFirst({
    where: eq(jams.id, jamId),
    with: { owner: true, members: { with: { user: true } } },
  });

  return NextResponse.json({
    ...jam,
    inviteCode,
    spotifyUrl: playlist.external_urls.spotify,
  });
}
