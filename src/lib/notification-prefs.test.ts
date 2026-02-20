import { describe, it, expect } from 'vitest';
import {
  parseNotificationPrefs,
  isNotificationEnabled,
  DEFAULT_NOTIFICATION_PREFS,
  NOTIFICATION_TYPES,
  type NotificationPrefs,
} from './notification-prefs';

describe('parseNotificationPrefs', () => {
  it('returns defaults for null', () => {
    const prefs = parseNotificationPrefs(null);
    expect(prefs).toEqual(DEFAULT_NOTIFICATION_PREFS);
  });

  it('returns defaults for undefined', () => {
    const prefs = parseNotificationPrefs(undefined);
    expect(prefs).toEqual(DEFAULT_NOTIFICATION_PREFS);
  });

  it('returns defaults for empty string', () => {
    const prefs = parseNotificationPrefs('');
    expect(prefs).toEqual(DEFAULT_NOTIFICATION_PREFS);
  });

  it('returns defaults for invalid JSON', () => {
    const prefs = parseNotificationPrefs('not valid json {{{');
    expect(prefs).toEqual(DEFAULT_NOTIFICATION_PREFS);
  });

  it('returns defaults for valid JSON that is not an object', () => {
    const prefs = parseNotificationPrefs('"just a string"');
    expect(prefs).toEqual(DEFAULT_NOTIFICATION_PREFS);
  });

  it('returns a new object each time (not the same reference)', () => {
    const a = parseNotificationPrefs(null);
    const b = parseNotificationPrefs(null);
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it('merges partial override with defaults', () => {
    const partial = {
      reactions: { push: false, email: true },
    };
    const prefs = parseNotificationPrefs(JSON.stringify(partial));

    // Overridden value
    expect(prefs.reactions).toEqual({ push: false, email: true });

    // Non-overridden values remain at defaults
    expect(prefs.newTrack).toEqual(DEFAULT_NOTIFICATION_PREFS.newTrack);
    expect(prefs.memberJoined).toEqual(DEFAULT_NOTIFICATION_PREFS.memberJoined);
    expect(prefs.trackRemoved).toEqual(DEFAULT_NOTIFICATION_PREFS.trackRemoved);
    expect(prefs.circleJoined).toEqual(DEFAULT_NOTIFICATION_PREFS.circleJoined);
    expect(prefs.playlistFollowed).toEqual(DEFAULT_NOTIFICATION_PREFS.playlistFollowed);
  });

  it('fills in missing channel within a partial type override', () => {
    // Only providing push, email should fall back to default
    const partial = {
      newTrack: { push: false },
    };
    const prefs = parseNotificationPrefs(JSON.stringify(partial));
    expect(prefs.newTrack.push).toBe(false);
    expect(prefs.newTrack.email).toBe(DEFAULT_NOTIFICATION_PREFS.newTrack.email);
  });

  it('handles full override of all types', () => {
    const full: NotificationPrefs = {
      newTrack: { push: false, email: false },
      memberJoined: { push: false, email: false },
      reactions: { push: false, email: false },
      trackRemoved: { push: true, email: false },
      circleJoined: { push: false, email: false },
      playlistFollowed: { push: true, email: true },
    };
    const prefs = parseNotificationPrefs(JSON.stringify(full));
    expect(prefs).toEqual(full);
  });

  it('ignores unknown keys in JSON', () => {
    const withExtra = {
      newTrack: { push: false, email: false },
      unknownType: { push: true, email: true },
    };
    const prefs = parseNotificationPrefs(JSON.stringify(withExtra));
    expect(prefs.newTrack).toEqual({ push: false, email: false });
    // unknownType should not appear
    expect((prefs as Record<string, unknown>)['unknownType']).toBeUndefined();
  });
});

describe('isNotificationEnabled', () => {
  it('returns correct values for default prefs', () => {
    const prefs = { ...DEFAULT_NOTIFICATION_PREFS };

    expect(isNotificationEnabled(prefs, 'newTrack', 'push')).toBe(true);
    expect(isNotificationEnabled(prefs, 'newTrack', 'email')).toBe(true);
    expect(isNotificationEnabled(prefs, 'reactions', 'push')).toBe(true);
    expect(isNotificationEnabled(prefs, 'reactions', 'email')).toBe(false);
    expect(isNotificationEnabled(prefs, 'trackRemoved', 'push')).toBe(false);
    expect(isNotificationEnabled(prefs, 'trackRemoved', 'email')).toBe(true);
    expect(isNotificationEnabled(prefs, 'playlistFollowed', 'push')).toBe(false);
    expect(isNotificationEnabled(prefs, 'playlistFollowed', 'email')).toBe(false);
  });

  it('returns overridden values for custom prefs', () => {
    const prefs: NotificationPrefs = {
      ...DEFAULT_NOTIFICATION_PREFS,
      reactions: { push: false, email: true },
    };

    expect(isNotificationEnabled(prefs, 'reactions', 'push')).toBe(false);
    expect(isNotificationEnabled(prefs, 'reactions', 'email')).toBe(true);
  });

  it('checks all notification types defined in NOTIFICATION_TYPES', () => {
    const prefs = { ...DEFAULT_NOTIFICATION_PREFS };

    // Every notification type should return a boolean for both channels
    for (const type of NOTIFICATION_TYPES) {
      const pushResult = isNotificationEnabled(prefs, type, 'push');
      const emailResult = isNotificationEnabled(prefs, type, 'email');
      expect(typeof pushResult).toBe('boolean');
      expect(typeof emailResult).toBe('boolean');
    }
  });
});

describe('DEFAULT_NOTIFICATION_PREFS', () => {
  it('has entries for all NOTIFICATION_TYPES', () => {
    for (const type of NOTIFICATION_TYPES) {
      expect(DEFAULT_NOTIFICATION_PREFS[type]).toBeDefined();
      expect(typeof DEFAULT_NOTIFICATION_PREFS[type].push).toBe('boolean');
      expect(typeof DEFAULT_NOTIFICATION_PREFS[type].email).toBe('boolean');
    }
  });
});

describe('NOTIFICATION_TYPES', () => {
  it('contains all six notification types', () => {
    expect(NOTIFICATION_TYPES).toHaveLength(6);
    expect(NOTIFICATION_TYPES).toContain('newTrack');
    expect(NOTIFICATION_TYPES).toContain('memberJoined');
    expect(NOTIFICATION_TYPES).toContain('reactions');
    expect(NOTIFICATION_TYPES).toContain('trackRemoved');
    expect(NOTIFICATION_TYPES).toContain('circleJoined');
    expect(NOTIFICATION_TYPES).toContain('playlistFollowed');
  });
});
