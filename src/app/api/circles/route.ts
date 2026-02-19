import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getUserCircles } from '@/lib/auth';
import { db } from '@/db';
import { circleMembers } from '@/db/schema';
import { sql } from 'drizzle-orm';

// GET /api/circles — list user's circles
export async function GET() {
  const user = await requireAuth();

  const memberships = await getUserCircles(user.id);

  // Get member counts for each circle
  const circleIds = memberships.map((m) => m.circleId);
  const memberCounts =
    circleIds.length > 0
      ? await db
          .select({
            circleId: circleMembers.circleId,
            count: sql<number>`count(*)`.as('count'),
          })
          .from(circleMembers)
          .where(
            sql`${circleMembers.circleId} IN (${sql.join(
              circleIds.map((id) => sql`${id}`),
              sql`, `
            )})`
          )
          .groupBy(circleMembers.circleId)
      : [];

  const countMap = new Map(memberCounts.map((c) => [c.circleId, Number(c.count)]));

  const result = memberships.map((m) => ({
    id: m.circle.id,
    name: m.circle.name,
    spotifyClientId: m.circle.spotifyClientId,
    inviteCode: m.circle.inviteCode,
    maxMembers: m.circle.maxMembers,
    createdAt: m.circle.createdAt,
    role: m.role,
    joinedAt: m.joinedAt,
    memberCount: countMap.get(m.circleId) ?? 0,
    host: {
      id: m.circle.host.id,
      displayName: m.circle.host.displayName,
      avatarUrl: m.circle.host.avatarUrl,
    },
  }));

  return NextResponse.json(result);
}

// POST /api/circles — create a new circle
// Circle creation requires OAuth with the circle's Spotify client ID.
// Use the OAuth login flow instead (GET /api/auth/login?action=create).
export async function POST(_request: NextRequest) {
  await requireAuth();

  return NextResponse.json(
    {
      error:
        'Use the OAuth flow to create a circle. Redirect to /login?action=create with the Spotify client ID.',
    },
    { status: 400 }
  );
}
