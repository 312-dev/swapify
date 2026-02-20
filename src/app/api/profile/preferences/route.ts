import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import {
  NOTIFICATION_TYPES,
  parseNotificationPrefs,
  type NotificationPrefs,
} from '@/lib/notification-prefs';

export async function PATCH(request: NextRequest) {
  const user = await requireAuth();
  const body = await request.json();

  const updates: Record<string, boolean | string> = {};

  // Display name
  if (typeof body.displayName === 'string') {
    const name = body.displayName.trim();
    if (name.length === 0 || name.length > 50) {
      return NextResponse.json({ error: 'Name must be 1-50 characters' }, { status: 400 });
    }
    updates.displayName = name;
  }

  // Master toggles
  if (body.notifyPush !== undefined) updates.notifyPush = !!body.notifyPush;
  if (body.notifyEmail !== undefined) updates.notifyEmail = !!body.notifyEmail;
  if (body.autoNegativeReactions !== undefined)
    updates.autoNegativeReactions = !!body.autoNegativeReactions;

  // Granular notification prefs: { notificationPrefs: { newTrack: { push: true, email: false }, ... } }
  if (body.notificationPrefs && typeof body.notificationPrefs === 'object') {
    const currentUser = await db.query.users.findFirst({ where: eq(users.id, user.id) });
    const current = parseNotificationPrefs(currentUser?.notificationPrefs);
    const incoming = body.notificationPrefs as Partial<NotificationPrefs>;

    for (const type of NOTIFICATION_TYPES) {
      if (incoming[type]) {
        if (typeof incoming[type].push === 'boolean') current[type].push = incoming[type].push;
        if (typeof incoming[type].email === 'boolean') current[type].email = incoming[type].email;
      }
    }

    updates.notificationPrefs = JSON.stringify(current);
  }

  // Reset to defaults
  if (body.resetNotificationPrefs) {
    updates.notificationPrefs = JSON.stringify(null);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 });
  }

  await db.update(users).set(updates).where(eq(users.id, user.id));
  return NextResponse.json({ success: true });
}
