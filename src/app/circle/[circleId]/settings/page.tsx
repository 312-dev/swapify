import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { db } from '@/db';
import { circles, circleMembers } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import CircleSettingsClient from './CircleSettingsClient';

export default async function CircleSettingsPage({
  params,
}: {
  params: Promise<{ circleId: string }>;
}) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    redirect('/login');
  }

  const { circleId } = await params;

  // Verify membership
  const membership = await db.query.circleMembers.findFirst({
    where: and(eq(circleMembers.circleId, circleId), eq(circleMembers.userId, user.id)),
  });
  if (!membership) {
    redirect('/dashboard');
  }

  const circle = await db.query.circles.findFirst({
    where: eq(circles.id, circleId),
    with: {
      members: {
        with: { user: true },
      },
    },
  });

  if (!circle) {
    redirect('/dashboard');
  }

  const isHost = circle.hostUserId === user.id;

  return (
    <CircleSettingsClient
      circle={{
        id: circle.id,
        name: circle.name,
        imageUrl: circle.imageUrl ?? null,
        spotifyClientId: circle.spotifyClientId,
        inviteCode: circle.inviteCode,
        maxMembers: circle.maxMembers,
        members: circle.members.map((m) => ({
          id: m.user.id,
          displayName: m.user.displayName,
          avatarUrl: m.user.avatarUrl ?? null,
          role: m.role,
          joinedAt: m.joinedAt?.toISOString() ?? '',
        })),
      }}
      isHost={isHost}
    />
  );
}
