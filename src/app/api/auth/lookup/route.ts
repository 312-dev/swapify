import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { db } from '@/db';
import { users, circleMembers } from '@/db/schema';
import { eq, sql, asc } from 'drizzle-orm';

// GET /api/auth/lookup?q=<spotify_username_or_email>
// Public endpoint — finds a returning user's first circle for sign-back-in
export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const limited = checkRateLimit(`public:${ip}`, RATE_LIMITS.public);
  if (limited) return limited;

  const rawQ = request.nextUrl.searchParams.get('q');
  if (!rawQ || rawQ.trim().length === 0) {
    return NextResponse.json({ error: 'No identifier provided' }, { status: 400 });
  }

  const q = rawQ.trim().toLowerCase();

  // Try Spotify username first, then verified email
  let user = await db.query.users.findFirst({
    where: sql`lower(${users.spotifyId}) = ${q}`,
  });

  if (!user) {
    user = await db.query.users.findFirst({
      where: sql`lower(${users.email}) = ${q}`,
    });
  }

  if (!user) {
    return NextResponse.json(
      { error: 'No account found for that username or email' },
      { status: 404 }
    );
  }

  // Get their oldest circle membership
  const membership = await db.query.circleMembers.findFirst({
    where: eq(circleMembers.userId, user.id),
    with: { circle: true },
    orderBy: asc(circleMembers.joinedAt),
  });

  if (!membership) {
    return NextResponse.json(
      { error: 'No account found for that username or email' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    spotifyClientId: membership.circle.spotifyClientId,
    circleId: membership.circleId,
  });
}
