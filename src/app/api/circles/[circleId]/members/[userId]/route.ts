import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/db';
import { circles, circleMembers } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

// DELETE /api/circles/[circleId]/members/[userId] — host removes a member
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ circleId: string; userId: string }> }
) {
  const user = await requireAuth();
  const { circleId, userId } = await params;

  // Look up the circle
  const circle = await db.query.circles.findFirst({
    where: eq(circles.id, circleId),
  });
  if (!circle) {
    return NextResponse.json({ error: 'Circle not found' }, { status: 404 });
  }

  // Only the host can remove members
  if (circle.hostUserId !== user.id) {
    return NextResponse.json({ error: 'Only the circle host can remove members' }, { status: 403 });
  }

  // Cannot remove the host themselves
  if (userId === circle.hostUserId) {
    return NextResponse.json({ error: 'Cannot remove the circle host' }, { status: 400 });
  }

  // Verify target user is a member
  const membership = await db.query.circleMembers.findFirst({
    where: and(eq(circleMembers.circleId, circleId), eq(circleMembers.userId, userId)),
  });
  if (!membership) {
    return NextResponse.json({ error: 'User is not a member of this circle' }, { status: 404 });
  }

  // Delete the membership row
  await db
    .delete(circleMembers)
    .where(and(eq(circleMembers.circleId, circleId), eq(circleMembers.userId, userId)));

  return NextResponse.json({ success: true });
}
