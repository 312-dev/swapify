import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getSession } from '@/lib/auth';
import { db } from '@/db';
import { circleMembers } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

// POST /api/circles/switch — switch active circle
export async function POST(request: NextRequest) {
  const user = await requireAuth();

  const body = await request.json();
  const { circleId } = body;

  if (!circleId || typeof circleId !== 'string') {
    return NextResponse.json({ error: 'circleId is required' }, { status: 400 });
  }

  // Verify user is a member of the target circle
  const membership = await db.query.circleMembers.findFirst({
    where: and(eq(circleMembers.circleId, circleId), eq(circleMembers.userId, user.id)),
    with: {
      circle: true,
    },
  });

  if (!membership) {
    return NextResponse.json({ error: 'Not a member of this circle' }, { status: 403 });
  }

  // Update session with new active circle
  const session = await getSession();
  session.activeCircleId = membership.circle.id;
  session.activeCircleName = membership.circle.name;
  await session.save();

  return NextResponse.json({
    success: true,
    circleId: membership.circle.id,
    circleName: membership.circle.name,
  });
}
