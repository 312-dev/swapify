import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { db } from '@/db';
import { circles, circleMembers } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

// GET /api/circles/resolve?code=xyz — resolve circle invite code to preview info
export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const limited = checkRateLimit(`public:${ip}`, RATE_LIMITS.public);
  if (limited) return limited;

  const rawCode = request.nextUrl.searchParams.get('code');

  if (!rawCode) {
    return NextResponse.json({ error: 'No code provided' }, { status: 400 });
  }

  const code = rawCode.trim().toLowerCase();

  const circle = await db.query.circles.findFirst({
    where: sql`lower(${circles.inviteCode}) = ${code}`,
    with: {
      host: true,
    },
  });

  if (!circle) {
    return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 });
  }

  // Get member count
  const [countResult] = await db
    .select({ count: sql<number>`count(*)`.as('count') })
    .from(circleMembers)
    .where(eq(circleMembers.circleId, circle.id));

  return NextResponse.json({
    id: circle.id,
    name: circle.name,
    spotifyClientId: circle.spotifyClientId,
    hostName: circle.host.displayName,
    memberCount: Number(countResult?.count ?? 0),
  });
}
