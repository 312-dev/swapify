import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { jams } from "@/db/schema";
import { eq } from "drizzle-orm";

// GET /api/jams/resolve?code=ABC123 — resolve invite code to jam
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "No code provided" }, { status: 400 });
  }

  const jam = await db.query.jams.findFirst({
    where: eq(jams.inviteCode, code),
    with: {
      owner: true,
      members: { with: { user: true } },
    },
  });

  if (!jam) {
    return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });
  }

  return NextResponse.json({
    id: jam.id,
    name: jam.name,
    description: jam.description,
    imageUrl: jam.imageUrl,
    inviteCode: jam.inviteCode,
    owner: {
      displayName: jam.owner.displayName,
      avatarUrl: jam.owner.avatarUrl,
    },
    memberCount: jam.members.length,
    members: jam.members.map((m) => ({
      displayName: m.user.displayName,
      avatarUrl: m.user.avatarUrl,
    })),
  });
}
