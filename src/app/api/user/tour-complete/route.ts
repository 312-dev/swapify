import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST() {
  const user = await requireAuth();

  await db.update(users).set({ hasCompletedTour: true }).where(eq(users.id, user.id));

  return NextResponse.json({ ok: true });
}
