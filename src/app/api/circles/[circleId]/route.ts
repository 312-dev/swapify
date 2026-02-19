import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getSession } from '@/lib/auth';
import { db } from '@/db';
import { circles, circleMembers } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

// GET /api/circles/[circleId] — get circle details
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

  const circle = await db.query.circles.findFirst({
    where: eq(circles.id, circleId),
    with: {
      host: true,
      members: {
        with: { user: true },
      },
    },
  });

  if (!circle) {
    return NextResponse.json({ error: 'Circle not found' }, { status: 404 });
  }

  return NextResponse.json({
    id: circle.id,
    name: circle.name,
    spotifyClientId: circle.spotifyClientId,
    inviteCode: circle.inviteCode,
    maxMembers: circle.maxMembers,
    createdAt: circle.createdAt,
    isHost: circle.hostUserId === user.id,
    host: {
      id: circle.host.id,
      displayName: circle.host.displayName,
      avatarUrl: circle.host.avatarUrl,
    },
    members: circle.members.map((m) => ({
      id: m.user.id,
      displayName: m.user.displayName,
      avatarUrl: m.user.avatarUrl,
      role: m.role,
      joinedAt: m.joinedAt,
    })),
  });
}

// PATCH /api/circles/[circleId] — update circle settings (host only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const user = await requireAuth();
  const { circleId } = await params;

  const circle = await db.query.circles.findFirst({
    where: eq(circles.id, circleId),
  });
  if (!circle) {
    return NextResponse.json({ error: 'Circle not found' }, { status: 404 });
  }
  if (circle.hostUserId !== user.id) {
    return NextResponse.json({ error: 'Not the host' }, { status: 403 });
  }

  const body = await request.json();
  const { name, maxMembers, imageBase64 } = body;

  const updates: Partial<typeof circles.$inferInsert> = {};

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name must be a non-empty string' }, { status: 400 });
    }
    updates.name = name.trim();
  }

  if (maxMembers !== undefined) {
    const parsed = Number(maxMembers);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 50) {
      return NextResponse.json({ error: 'maxMembers must be between 1 and 50' }, { status: 400 });
    }
    updates.maxMembers = parsed;
  }

  if (imageBase64 !== undefined) {
    if (imageBase64 === null) {
      updates.imageUrl = null;
    } else if (typeof imageBase64 === 'string' && imageBase64.length > 0) {
      // Validate size (256KB max for the base64 string)
      if (imageBase64.length > 350_000) {
        return NextResponse.json({ error: 'Image must be under 256KB' }, { status: 400 });
      }
      updates.imageUrl = `data:image/jpeg;base64,${imageBase64}`;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  await db.update(circles).set(updates).where(eq(circles.id, circleId));

  // If name was updated, also update the session if this is the active circle
  if (updates.name) {
    const session = await getSession();
    if (session.activeCircleId === circleId) {
      session.activeCircleName = updates.name;
      await session.save();
    }
  }

  const updated = await db.query.circles.findFirst({
    where: eq(circles.id, circleId),
    with: {
      host: true,
      members: { with: { user: true } },
    },
  });

  return NextResponse.json(updated);
}

// DELETE /api/circles/[circleId] — delete circle (host only)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const user = await requireAuth();
  const { circleId } = await params;

  const circle = await db.query.circles.findFirst({
    where: eq(circles.id, circleId),
  });
  if (!circle) {
    return NextResponse.json({ error: 'Circle not found' }, { status: 404 });
  }
  if (circle.hostUserId !== user.id) {
    return NextResponse.json({ error: 'Not the host' }, { status: 403 });
  }

  // Cascade delete handles circle_members (ON DELETE CASCADE)
  await db.delete(circles).where(eq(circles.id, circleId));

  // Clear active circle from session if it was this circle
  const session = await getSession();
  if (session.activeCircleId === circleId) {
    session.activeCircleId = undefined;
    session.activeCircleName = undefined;
    await session.save();
  }

  return NextResponse.json({ success: true });
}
