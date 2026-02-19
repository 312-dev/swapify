import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/db';
import { playlists, playlistMembers } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { vibeSort } from '@/lib/vibe-sort';

// POST /api/playlists/[playlistId]/tracks/sort-by-vibe — reorder tracks by vibe (exciting -> calm)
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ playlistId: string }> }
) {
  const user = await requireAuth();
  const { playlistId } = await params;

  // Verify membership
  const membership = await db.query.playlistMembers.findFirst({
    where: and(eq(playlistMembers.playlistId, playlistId), eq(playlistMembers.userId, user.id)),
  });
  if (!membership) {
    return NextResponse.json({ error: 'Not a member' }, { status: 403 });
  }

  // Get playlist — only owner can reorder (Spotify requires owner token)
  const playlist = await db.query.playlists.findFirst({
    where: eq(playlists.id, playlistId),
  });
  if (!playlist) {
    return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });
  }
  if (playlist.ownerId !== user.id) {
    return NextResponse.json({ error: 'Only the playlist owner can sort tracks' }, { status: 403 });
  }

  await vibeSort(playlistId);

  return NextResponse.json({ success: true });
}
