import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { jams, jamMembers, emailInvites } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { sendEmail } from "@/lib/email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jamId: string }> }
) {
  const user = await requireAuth();
  const { jamId } = await params;

  const body = await request.json();
  const email = (body.email as string)?.trim().toLowerCase();

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "A valid email address is required." },
      { status: 400 }
    );
  }

  // Verify jam exists
  const jam = await db.query.jams.findFirst({
    where: eq(jams.id, jamId),
  });
  if (!jam) {
    return NextResponse.json({ error: "Dig not found." }, { status: 404 });
  }

  // Verify sender is a member
  const membership = await db.query.jamMembers.findFirst({
    where: and(eq(jamMembers.jamId, jamId), eq(jamMembers.userId, user.id)),
  });
  if (!membership) {
    return NextResponse.json(
      { error: "You must be a member to invite others." },
      { status: 403 }
    );
  }

  // Check if this email was already invited to this jam
  const existing = await db.query.emailInvites.findFirst({
    where: and(
      eq(emailInvites.jamId, jamId),
      eq(emailInvites.recipientEmail, email)
    ),
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
    // First invite for this email + jam
    await db.insert(emailInvites).values({
      id: nanoid(),
      jamId,
      senderUserId: user.id,
      recipientEmail: email,
    });
  }

  // Send the invite email
  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/jam/join?code=${jam.inviteCode}`;

  await sendEmail(
    email,
    `You're invited to "${jam.name}"`,
    `${user.displayName} invited you to join their Deep Dig "<strong>${jam.name}</strong>"${jam.description ? ` — ${jam.description}` : ""}. Tap below to join and start sharing music together.`,
    inviteUrl
  );

  return NextResponse.json({ success: true });
}
