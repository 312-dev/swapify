import webpush from 'web-push';
import { db } from '@/db';
import { pushSubscriptions, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { sendEmail } from './email';
import {
  type NotificationType,
  parseNotificationPrefs,
  isNotificationEnabled,
} from './notification-prefs';

// Configure web-push with VAPID keys
if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:noreply@swapify.app',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

interface NotificationPayload {
  title: string;
  body: string;
  url?: string;
}

export async function notify(
  userId: string,
  payload: NotificationPayload,
  type?: NotificationType
): Promise<void> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  if (!user) return;

  const prefs = parseNotificationPrefs(user.notificationPrefs);

  // Send push notification if master toggle + per-type pref both enabled
  const pushEnabled = user.notifyPush && (!type || isNotificationEnabled(prefs, type, 'push'));
  if (pushEnabled) {
    await sendPushNotification(userId, payload);
  }

  // Send email notification if master toggle + per-type pref both enabled + email is set
  const emailEnabled =
    user.notifyEmail && user.email && (!type || isNotificationEnabled(prefs, type, 'email'));
  if (emailEnabled) {
    await sendEmail(user.email!, payload.title, payload.body, payload.url, userId);
  }
}

export async function notifyPlaylistMembers(
  playlistId: string,
  excludeUserId: string,
  payload: NotificationPayload,
  type?: NotificationType
): Promise<void> {
  const { playlistMembers } = await import('@/db/schema');

  const members = await db.query.playlistMembers.findMany({
    where: eq(playlistMembers.playlistId, playlistId),
  });

  await Promise.allSettled(
    members.filter((m) => m.userId !== excludeUserId).map((m) => notify(m.userId, payload, type))
  );
}

async function sendPushNotification(userId: string, payload: NotificationPayload): Promise<void> {
  const subs = await db.query.pushSubscriptions.findMany({
    where: eq(pushSubscriptions.userId, userId),
  });

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        JSON.stringify(payload)
      );
    } catch (error: unknown) {
      // If subscription is expired (410 Gone), remove it
      if (
        error &&
        typeof error === 'object' &&
        'statusCode' in error &&
        (error as { statusCode: number }).statusCode === 410
      ) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
      }
    }
  }
}
