/**
 * Granular notification preferences per event type and channel.
 * Stored as JSON in users.notificationPrefs.
 * When null/missing, DEFAULT_NOTIFICATION_PREFS is used.
 */

export type NotificationType =
  | 'newTrack'
  | 'memberJoined'
  | 'reactions'
  | 'trackRemoved'
  | 'circleJoined'
  | 'playlistFollowed';

export interface ChannelPrefs {
  push: boolean;
  email: boolean;
}

export type NotificationPrefs = Record<NotificationType, ChannelPrefs>;

export const NOTIFICATION_TYPE_LABELS: Record<
  NotificationType,
  { label: string; description: string }
> = {
  newTrack: { label: 'New tracks', description: 'When someone adds a track' },
  memberJoined: { label: 'New members', description: 'When someone joins a Swaplist' },
  reactions: { label: 'Reactions', description: 'When someone reacts to your track' },
  trackRemoved: { label: 'Track removed', description: 'When your track is removed' },
  circleJoined: { label: 'Circle joins', description: 'When someone joins your Circle' },
  playlistFollowed: {
    label: 'Playlist follows',
    description: 'When someone follows a Swaplist on Spotify',
  },
};

export const NOTIFICATION_TYPES = Object.keys(NOTIFICATION_TYPE_LABELS) as NotificationType[];

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  newTrack: { push: true, email: true },
  memberJoined: { push: true, email: true },
  reactions: { push: true, email: false },
  trackRemoved: { push: false, email: true },
  circleJoined: { push: true, email: true },
  playlistFollowed: { push: false, email: false },
};

/** Parse stored JSON prefs, merging with defaults for any missing keys */
export function parseNotificationPrefs(json: string | null | undefined): NotificationPrefs {
  if (!json) return { ...DEFAULT_NOTIFICATION_PREFS };

  try {
    const parsed = JSON.parse(json) as Partial<NotificationPrefs>;
    const result = { ...DEFAULT_NOTIFICATION_PREFS };
    for (const type of NOTIFICATION_TYPES) {
      if (parsed[type]) {
        result[type] = {
          push: parsed[type].push ?? DEFAULT_NOTIFICATION_PREFS[type].push,
          email: parsed[type].email ?? DEFAULT_NOTIFICATION_PREFS[type].email,
        };
      }
    }
    return result;
  } catch {
    return { ...DEFAULT_NOTIFICATION_PREFS };
  }
}

/** Check if a specific notification type + channel is enabled for a user */
export function isNotificationEnabled(
  prefs: NotificationPrefs,
  type: NotificationType,
  channel: 'push' | 'email'
): boolean {
  return prefs[type]?.[channel] ?? DEFAULT_NOTIFICATION_PREFS[type][channel];
}
