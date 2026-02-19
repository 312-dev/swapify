import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getSession } from '@/lib/auth';
import { db } from '@/db';
import { circles, circleMembers } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

// POST /api/circles/[circleId]/leave — leave a circle
export async function POST(
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
    return NextResponse.json({ error: 'Not a member of this circle' }, { status: 403 });
  }

  // Host cannot leave — they must delete the circle
  const circle = await db.query.circles.findFirst({
    where: eq(circles.id, circleId),
  });
  if (!circle) {
    return NextResponse.json({ error: 'Circle not found' }, { status: 404 });
  }
  if (circle.hostUserId === user.id) {
    return NextResponse.json(
      { error: 'Host cannot leave the circle. Delete it instead.' },
      { status: 400 }
    );
  }

  // Delete the membership row
  await db
    .delete(circleMembers)
    .where(and(eq(circleMembers.circleId, circleId), eq(circleMembers.userId, user.id)));

  // Clear active circle from session if it was this circle
  const session = await getSession();
  if (session.activeCircleId === circleId) {
    session.activeCircleId = undefined;
    session.activeCircleName = undefined;
    await session.save();
  }

  return NextResponse.json({ success: true });
}
