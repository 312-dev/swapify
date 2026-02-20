import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { db } from '@/db';
import { circleInvites, circleMembers } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

// GET /api/circles/resolve-invite?token=<invite_token>
// Public endpoint — resolves an email invite token to circle preview
export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const limited = checkRateLimit(`public:${ip}`, RATE_LIMITS.public);
  if (limited) return limited;

  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'No token provided' }, { status: 400 });
  }

  const invite = await db.query.circleInvites.findFirst({
    where: eq(circleInvites.inviteToken, token.trim()),
    with: {
      circle: {
        with: { host: true },
      },
    },
  });

  if (!invite) {
    return NextResponse.json({ error: 'Invalid invite link' }, { status: 404 });
  }

  if (invite.usedAt) {
    return NextResponse.json({ error: 'This invite has already been used' }, { status: 410 });
  }

  if (invite.expiresAt < Date.now()) {
    return NextResponse.json({ error: 'This invite has expired' }, { status: 410 });
  }

  // Get member count
  const [countResult] = await db
    .select({ count: sql<number>`count(*)`.as('count') })
    .from(circleMembers)
    .where(eq(circleMembers.circleId, invite.circleId));

  return NextResponse.json({
    id: invite.circle.id,
    name: invite.circle.name,
    spotifyClientId: invite.circle.spotifyClientId,
    hostName: invite.circle.host.displayName,
    memberCount: Number(countResult?.count ?? 0),
    recipientEmail: invite.recipientEmail,
  });
}
