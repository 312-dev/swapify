import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { db } from '@/db';
import { playlists, circles, circleMembers } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

// GET /api/playlists/resolve?code=ABC123 — resolve invite code (playlist or circle)
export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const limited = checkRateLimit(`public:${ip}`, RATE_LIMITS.public);
  if (limited) return limited;

  const rawCode = request.nextUrl.searchParams.get('code');

  if (!rawCode) {
    return NextResponse.json({ error: 'No code provided' }, { status: 400 });
  }

  const code = rawCode.trim().toLowerCase();

  // Try playlist first
  const playlist = await db.query.playlists.findFirst({
    where: sql`lower(${playlists.inviteCode}) = ${code}`,
    with: {
      owner: true,
      members: { with: { user: true } },
    },
  });

  if (playlist) {
    return NextResponse.json({
      type: 'playlist',
      id: playlist.id,
      name: playlist.name,
      description: playlist.description,
      imageUrl: playlist.imageUrl,
      inviteCode: playlist.inviteCode,
      owner: {
        displayName: playlist.owner.displayName,
        avatarUrl: playlist.owner.avatarUrl,
      },
      memberCount: playlist.members.length,
      members: playlist.members.map((m) => ({
        displayName: m.user.displayName,
        avatarUrl: m.user.avatarUrl,
      })),
    });
  }

  // Try circle
  const circle = await db.query.circles.findFirst({
    where: sql`lower(${circles.inviteCode}) = ${code}`,
    with: { host: true },
  });

  if (circle) {
    const [countResult] = await db
      .select({ count: sql<number>`count(*)`.as('count') })
      .from(circleMembers)
      .where(eq(circleMembers.circleId, circle.id));

    return NextResponse.json({
      type: 'circle',
      id: circle.id,
      name: circle.name,
      spotifyClientId: circle.spotifyClientId,
      hostName: circle.host.displayName,
      memberCount: Number(countResult?.count ?? 0),
    });
  }

  return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 });
}
