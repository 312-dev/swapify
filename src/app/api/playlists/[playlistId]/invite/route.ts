import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/db';
import { playlists, playlistMembers, emailInvites } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { sendEmail } from '@/lib/email';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ playlistId: string }> }
) {
  const user = await requireAuth();
  const { playlistId } = await params;

  const body = await request.json();
  const email = (body.email as string)?.trim().toLowerCase();

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });
  }

  // Verify playlist exists
  const playlist = await db.query.playlists.findFirst({
    where: eq(playlists.id, playlistId),
  });
  if (!playlist) {
    return NextResponse.json({ error: 'Playlist not found.' }, { status: 404 });
  }

  // Verify sender is a member
  const membership = await db.query.playlistMembers.findFirst({
    where: and(eq(playlistMembers.playlistId, playlistId), eq(playlistMembers.userId, user.id)),
  });
  if (!membership) {
    return NextResponse.json({ error: 'You must be a member to invite others.' }, { status: 403 });
  }

  // Check if this email was already invited to this playlist
  const existing = await db.query.emailInvites.findFirst({
    where: and(eq(emailInvites.playlistId, playlistId), eq(emailInvites.recipientEmail, email)),
  });

  if (existing) {
    const elapsed = Date.now() - existing.sentAt.getTime();
    if (elapsed < COOLDOWN_MS) {
      const hoursLeft = Math.ceil((COOLDOWN_MS - elapsed) / (60 * 60 * 1000));
      return NextResponse.json(
        {
          error: `This email was already invited. You can resend in ${hoursLeft}h.`,
        },
        { status: 429 }
      );
    }

    // Cooldown expired — update the existing record with fresh timestamp
    await db
      .update(emailInvites)
      .set({ sentAt: new Date(), senderUserId: user.id })
      .where(eq(emailInvites.id, existing.id));
  } else {
    // First invite for this email + playlist
    await db.insert(emailInvites).values({
      id: nanoid(),
      playlistId: playlistId,
      senderUserId: user.id,
      recipientEmail: email,
    });
  }

  // Send the invite email
  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/playlist/join?code=${playlist.inviteCode}`;

  await sendEmail(
    email,
    `You're invited to "${playlist.name}"`,
    `${user.displayName} invited you to join their Swaplist "<strong>${playlist.name}</strong>"${playlist.description ? ` — ${playlist.description}` : ''}. Tap below to join and start sharing music together.`,
    inviteUrl
  );

  return NextResponse.json({ success: true });
}
