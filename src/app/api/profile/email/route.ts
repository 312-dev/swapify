import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { sendEmail } from '@/lib/email';

export async function POST(request: Request) {
  const user = await requireAuth();
  const { email } = await request.json();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
  }

  const token = nanoid(32);
  const expiry = Date.now() + 60 * 60 * 1000;

  await db
    .update(users)
    .set({
      pendingEmail: email,
      emailVerifyToken: token,
      emailVerifyExpiresAt: expiry,
    })
    .where(eq(users.id, user.id));

  const verifyUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/profile/email/verify?token=${token}`;

  await sendEmail(
    email,
    'Confirm your email',
    'Click the link below to confirm your email address for Swapify.',
    verifyUrl
  );

  return NextResponse.json({ success: true });
}

export async function DELETE() {
  const user = await requireAuth();

  await db
    .update(users)
    .set({
      pendingEmail: null,
      emailVerifyToken: null,
      emailVerifyExpiresAt: null,
    })
    .where(eq(users.id, user.id));

  return NextResponse.json({ success: true });
}
