import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { db } from '@/db';
import { circles, circleInvites } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { sendEmail } from '@/lib/email';
import { generateId } from '@/lib/utils';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const user = await requireAuth();

  const limited = checkRateLimit(`invite:${user.id}`, RATE_LIMITS.invite);
  if (limited) return limited;

  const { circleId } = await params;

  const body = await request.json();
  const email = (body.email as string)?.trim().toLowerCase();

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });
  }

  // Verify circle exists and sender is the host
  const circle = await db.query.circles.findFirst({
    where: eq(circles.id, circleId),
  });
  if (!circle) {
    return NextResponse.json({ error: 'Circle not found.' }, { status: 404 });
  }
  if (circle.hostUserId !== user.id) {
    return NextResponse.json({ error: 'Only the circle host can invite others.' }, { status: 403 });
  }

  // Generate unique invite token tied to this recipient
  const inviteToken = nanoid(32);
  await db.insert(circleInvites).values({
    id: generateId(),
    circleId,
    senderUserId: user.id,
    recipientEmail: email,
    inviteToken,
    expiresAt: Date.now() + INVITE_EXPIRY_MS,
  });

  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/circle/join?invite=${inviteToken}`;

  await sendEmail(
    email,
    `You're invited to join "${circle.name}"`,
    `${user.displayName} invited you to join their circle "<strong>${circle.name}</strong>" on Swapify. Once you join, you'll see all their shared playlists and can start swapping music together.`,
    inviteUrl
  );

  return NextResponse.json({ success: true });
}
