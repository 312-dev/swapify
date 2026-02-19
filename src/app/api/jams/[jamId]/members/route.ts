import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { jamMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// GET /api/jams/[jamId]/members
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

  const members = await db.query.jamMembers.findMany({
    where: eq(jamMembers.jamId, jamId),
    with: { user: true },
  });

  return NextResponse.json(
    members.map((m) => ({
      id: m.user.id,
      displayName: m.user.displayName,
      avatarUrl: m.user.avatarUrl,
      joinedAt: m.joinedAt,
    }))
  );
}
