import { describe, it, expect } from 'vitest';
import {
  parseNotificationPrefs,
  isNotificationEnabled,
  DEFAULT_NOTIFICATION_PREFS,
} from '@/lib/notification-prefs';

// ─── parseNotificationPrefs ─────────────────────────────────────────────────

describe('parseNotificationPrefs', () => {
  it('returns defaults when passed null', () => {
    const result = parseNotificationPrefs(null);
    expect(result).toEqual(DEFAULT_NOTIFICATION_PREFS);
  });

  it('returns defaults when passed undefined', () => {
    const result = parseNotificationPrefs(undefined);
    expect(result).toEqual(DEFAULT_NOTIFICATION_PREFS);
  });

  it('returns defaults for invalid JSON without throwing', () => {
    const result = parseNotificationPrefs('not valid json {{{');
    expect(result).toEqual(DEFAULT_NOTIFICATION_PREFS);
  });

  it('overrides specified types while keeping others at defaults', () => {
    const json = JSON.stringify({
      reactions: { push: false, email: true },
    });
    const result = parseNotificationPrefs(json);

    // The overridden type should reflect the provided values
    expect(result.reactions).toEqual({ push: false, email: true });

    // All other types should remain at defaults
    expect(result.newTrack).toEqual(DEFAULT_NOTIFICATION_PREFS.newTrack);
    expect(result.memberJoined).toEqual(DEFAULT_NOTIFICATION_PREFS.memberJoined);
    expect(result.trackRemoved).toEqual(DEFAULT_NOTIFICATION_PREFS.trackRemoved);
    expect(result.circleJoined).toEqual(DEFAULT_NOTIFICATION_PREFS.circleJoined);
    expect(result.playlistFollowed).toEqual(DEFAULT_NOTIFICATION_PREFS.playlistFollowed);
  });

  it('fills in missing channel with default when only one channel is provided', () => {
    const json = JSON.stringify({
      newTrack: { push: false },
    });
    const result = parseNotificationPrefs(json);

    // push was explicitly set to false
    expect(result.newTrack.push).toBe(false);
    // email was omitted, so it should fall back to the default (true)
    expect(result.newTrack.email).toBe(true);
  });
});

// ─── isNotificationEnabled ──────────────────────────────────────────────────

describe('isNotificationEnabled', () => {
  it('returns the correct boolean for each channel and type', () => {
    const prefs = { ...DEFAULT_NOTIFICATION_PREFS };

    // newTrack defaults: push=true, email=true
    expect(isNotificationEnabled(prefs, 'newTrack', 'push')).toBe(true);
    expect(isNotificationEnabled(prefs, 'newTrack', 'email')).toBe(true);

    // reactions defaults: push=true, email=false
    expect(isNotificationEnabled(prefs, 'reactions', 'push')).toBe(true);
    expect(isNotificationEnabled(prefs, 'reactions', 'email')).toBe(false);

    // trackRemoved defaults: push=false, email=true
    expect(isNotificationEnabled(prefs, 'trackRemoved', 'push')).toBe(false);
    expect(isNotificationEnabled(prefs, 'trackRemoved', 'email')).toBe(true);

    // playlistFollowed defaults: push=false, email=false
    expect(isNotificationEnabled(prefs, 'playlistFollowed', 'push')).toBe(false);
    expect(isNotificationEnabled(prefs, 'playlistFollowed', 'email')).toBe(false);
  });
});
