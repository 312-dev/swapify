import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { jamMembers, jamTracks, trackReactions, users } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { generateId } from "@/lib/utils";

// POST /api/jams/[jamId]/reactions — add/update a reaction
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
  const { spotifyTrackId, reaction } = body;

  if (!spotifyTrackId || !reaction) {
    return NextResponse.json(
      { error: "Missing spotifyTrackId or reaction" },
      { status: 400 }
    );
  }

  // Prevent reacting to your own track
  const track = await db.query.jamTracks.findFirst({
    where: and(
      eq(jamTracks.jamId, jamId),
      eq(jamTracks.spotifyTrackId, spotifyTrackId),
      isNull(jamTracks.removedAt)
    ),
  });
  if (track && track.addedByUserId === user.id) {
    return NextResponse.json(
      { error: "Cannot react to your own track" },
      { status: 403 }
    );
  }

  // Check for existing reaction from this user on this track
  const existing = await db.query.trackReactions.findFirst({
    where: and(
      eq(trackReactions.jamId, jamId),
      eq(trackReactions.spotifyTrackId, spotifyTrackId),
      eq(trackReactions.userId, user.id)
    ),
  });

  if (existing) {
    // Update existing reaction
    await db
      .update(trackReactions)
      .set({ reaction, isAuto: 0 })
      .where(eq(trackReactions.id, existing.id));
  } else {
    // Insert new reaction
    await db.insert(trackReactions).values({
      id: generateId(),
      jamId,
      spotifyTrackId,
      userId: user.id,
      reaction,
      isAuto: 0,
    });
  }

  // Update user's recent emojis if it's a custom emoji (not thumbs_up/thumbs_down)
  if (reaction !== "thumbs_up" && reaction !== "thumbs_down") {
    const currentUser = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });
    const recentEmojis: string[] = currentUser?.recentEmojis
      ? JSON.parse(currentUser.recentEmojis)
      : [];
    const updated = [
      reaction,
      ...recentEmojis.filter((e) => e !== reaction),
    ].slice(0, 3);
    await db
      .update(users)
      .set({ recentEmojis: JSON.stringify(updated) })
      .where(eq(users.id, user.id));
  }

  return NextResponse.json({ success: true });
}

// DELETE /api/jams/[jamId]/reactions — remove a reaction
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ jamId: string }> }
) {
  const user = await requireAuth();
  const { jamId } = await params;

  const body = await request.json();
  const { spotifyTrackId } = body;

  await db
    .delete(trackReactions)
    .where(
      and(
        eq(trackReactions.jamId, jamId),
        eq(trackReactions.spotifyTrackId, spotifyTrackId),
        eq(trackReactions.userId, user.id)
      )
    );

  return NextResponse.json({ success: true });
}
