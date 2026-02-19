import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { jams, jamMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { vibeSort } from "@/lib/vibe-sort";

// POST /api/jams/[jamId]/tracks/sort-by-vibe — reorder tracks by vibe (exciting → calm)
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

  // Get jam — only owner can reorder (Spotify requires owner token)
  const jam = await db.query.jams.findFirst({
    where: eq(jams.id, jamId),
  });
  if (!jam) {
    return NextResponse.json({ error: "Jam not found" }, { status: 404 });
  }
  if (jam.ownerId !== user.id) {
    return NextResponse.json(
      { error: "Only the dig owner can sort tracks" },
      { status: 403 }
    );
  }

  await vibeSort(jamId);

  return NextResponse.json({ success: true });
}
