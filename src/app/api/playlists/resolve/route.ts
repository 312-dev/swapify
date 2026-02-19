import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { playlists } from '@/db/schema';
import { eq } from 'drizzle-orm';

// GET /api/playlists/resolve?code=ABC123 — resolve invite code to playlist
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');

  if (!code) {
    return NextResponse.json({ error: 'No code provided' }, { status: 400 });
  }

  const playlist = await db.query.playlists.findFirst({
    where: eq(playlists.inviteCode, code),
    with: {
      owner: true,
      members: { with: { user: true } },
    },
  });

  if (!playlist) {
    return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 });
  }

  return NextResponse.json({
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
