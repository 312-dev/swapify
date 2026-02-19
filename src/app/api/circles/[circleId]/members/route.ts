import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/db';
import { circleMembers } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

// GET /api/circles/[circleId]/members — list circle members
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const user = await requireAuth();
  const { circleId } = await params;

  // Verify membership
  const membership = await db.query.circleMembers.findFirst({
    where: and(eq(circleMembers.circleId, circleId), eq(circleMembers.userId, user.id)),
  });
  if (!membership) {
    return NextResponse.json({ error: 'Not a member' }, { status: 403 });
  }

  const members = await db.query.circleMembers.findMany({
    where: eq(circleMembers.circleId, circleId),
    with: { user: true },
  });

  return NextResponse.json(
    members.map((m) => ({
      id: m.user.id,
      displayName: m.user.displayName,
      avatarUrl: m.user.avatarUrl,
      role: m.role,
      joinedAt: m.joinedAt,
    }))
  );
}
