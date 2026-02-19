import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { jams, jamMembers, jamTracks, trackListens, users } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { updatePlaylistDetails, uploadPlaylistImage, createPlaylist } from "@/lib/spotify";

// GET /api/jams/[jamId] — jam detail
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

  const jam = await db.query.jams.findFirst({
    where: eq(jams.id, jamId),
    with: {
      owner: true,
      members: { with: { user: true } },
    },
  });

  if (!jam) {
    return NextResponse.json({ error: "Jam not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...jam,
    members: jam.members.map((m) => ({
      id: m.user.id,
      displayName: m.user.displayName,
      avatarUrl: m.user.avatarUrl,
      joinedAt: m.joinedAt,
    })),
    isOwner: jam.ownerId === user.id,
  });
}

// PATCH /api/jams/[jamId] — update jam settings (owner only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ jamId: string }> }
) {
  const user = await requireAuth();
  const { jamId } = await params;

  const jam = await db.query.jams.findFirst({
    where: eq(jams.id, jamId),
  });
  if (!jam) {
    return NextResponse.json({ error: "Jam not found" }, { status: 404 });
  }
  if (jam.ownerId !== user.id) {
    return NextResponse.json({ error: "Not the owner" }, { status: 403 });
  }

  const body = await request.json();
  const { name, description, imageBase64, archiveThreshold, maxTracksPerUser, maxTrackAgeDays } = body;

  const validThresholds = ["none", "no_dislikes", "at_least_one_like", "universally_liked"];

  const updates: Partial<typeof jams.$inferInsert> = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;

  // Handle archive threshold
  if (archiveThreshold !== undefined) {
    if (!validThresholds.includes(archiveThreshold)) {
      return NextResponse.json({ error: "Invalid archive threshold" }, { status: 400 });
    }
    updates.archiveThreshold = archiveThreshold;

    // Auto-create Keepers playlist when enabling archiving for the first time
    if (archiveThreshold !== "none" && !jam.archivePlaylistId) {
      const keepersPlaylist = await createPlaylist(
        user.id,
        `${jam.name} Keepers`,
        `Favorite tracks from ${jam.name}`,
        { collaborative: false }
      );
      updates.archivePlaylistId = keepersPlaylist.id;
    }
  }

  // Handle max tracks per user
  if (maxTracksPerUser !== undefined) {
    if (maxTracksPerUser === null) {
      updates.maxTracksPerUser = null;
    } else {
      const parsed = Number.parseInt(maxTracksPerUser, 10);
      if (Number.isNaN(parsed) || parsed < 1 || parsed > 50) {
        return NextResponse.json(
          { error: "Max tracks must be between 1 and 50" },
          { status: 400 }
        );
      }
      updates.maxTracksPerUser = parsed;
    }
  }

  // Handle max track age
  if (maxTrackAgeDays !== undefined) {
    const days = Number(maxTrackAgeDays);
    if (!Number.isInteger(days) || days < 0 || days > 365) {
      return NextResponse.json(
        { error: "Max track age must be 0-365 days" },
        { status: 400 }
      );
    }
    updates.maxTrackAgeDays = days;
  }

  // Update Spotify playlist details
  const spotifyUpdates: { name?: string; description?: string } = {};
  if (name) spotifyUpdates.name = name;
  if (description !== undefined) spotifyUpdates.description = description;

  if (Object.keys(spotifyUpdates).length > 0) {
    await updatePlaylistDetails(user.id, jam.spotifyPlaylistId, spotifyUpdates);
  }

  // Upload cover image if provided
  if (imageBase64) {
    await uploadPlaylistImage(user.id, jam.spotifyPlaylistId, imageBase64);
    updates.imageUrl = `data:image/jpeg;base64,${imageBase64.substring(0, 50)}...`;
  }

  if (Object.keys(updates).length > 0) {
    await db.update(jams).set(updates).where(eq(jams.id, jamId));
  }

  const updated = await db.query.jams.findFirst({
    where: eq(jams.id, jamId),
    with: { owner: true, members: { with: { user: true } } },
  });

  return NextResponse.json(updated);
}

// DELETE /api/jams/[jamId] — delete jam (owner only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ jamId: string }> }
) {
  const user = await requireAuth();
  const { jamId } = await params;

  const jam = await db.query.jams.findFirst({
    where: eq(jams.id, jamId),
  });
  if (!jam) {
    return NextResponse.json({ error: "Jam not found" }, { status: 404 });
  }
  if (jam.ownerId !== user.id) {
    return NextResponse.json({ error: "Not the owner" }, { status: 403 });
  }

  // Cascade delete handles members, tracks, listens
  await db.delete(jams).where(eq(jams.id, jamId));

  return NextResponse.json({ success: true });
}
