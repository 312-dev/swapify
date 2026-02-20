import { describe, it, expect } from 'vitest';
import {
  formatPlaylistName,
  needsGroupName,
  getFirstName,
  getRemovalDelayMs,
  formatRemovalDelay,
  formatRelativeTime,
  generateId,
  generateInviteCode,
  type RemovalDelay,
} from '../utils';

// ─── formatPlaylistName ─────────────────────────────────────────────────────

describe('formatPlaylistName', () => {
  it('returns "Swapify" for an empty member list', () => {
    expect(formatPlaylistName([])).toBe('Swapify');
  });

  it('returns initials for 1 member', () => {
    expect(formatPlaylistName(['Alice'])).toBe('A Swapify');
  });

  it('returns joined initials for 2 members', () => {
    expect(formatPlaylistName(['Alice', 'Bob'])).toBe('A+B Swapify');
  });

  it('returns joined initials for 3 members', () => {
    expect(formatPlaylistName(['Alice', 'Bob', 'Charlie'])).toBe('A+B+C Swapify');
  });

  it('uses groupName when provided', () => {
    expect(formatPlaylistName(['Alice', 'Bob'], 'Squad')).toBe('Squad Swapify');
  });

  it('truncates groupName at 15 characters', () => {
    const longName = 'ThisIsAVeryLongGroupName';
    const result = formatPlaylistName(['Alice'], longName);
    expect(result).toBe(`${longName.slice(0, 15)} Swapify`);
    // The prefix before " Swapify" should be at most 15 chars
    expect(result.replace(' Swapify', '').length).toBeLessThanOrEqual(15);
  });
});

// ─── needsGroupName ─────────────────────────────────────────────────────────

describe('needsGroupName', () => {
  it('returns false for 1-3 members', () => {
    expect(needsGroupName(1)).toBe(false);
    expect(needsGroupName(2)).toBe(false);
    expect(needsGroupName(3)).toBe(false);
  });

  it('returns true for 4+ members', () => {
    expect(needsGroupName(4)).toBe(true);
    expect(needsGroupName(10)).toBe(true);
  });
});

// ─── getFirstName ───────────────────────────────────────────────────────────

describe('getFirstName', () => {
  it('extracts the first name from a full name', () => {
    expect(getFirstName('John Doe')).toBe('John');
  });

  it('returns the whole string when there is no space', () => {
    expect(getFirstName('SingleName')).toBe('SingleName');
  });
});

// ─── getRemovalDelayMs ──────────────────────────────────────────────────────

describe('getRemovalDelayMs', () => {
  const expected: Record<RemovalDelay, number> = {
    immediate: 0,
    '1h': 3_600_000,
    '12h': 43_200_000,
    '24h': 86_400_000,
    '3d': 259_200_000,
    '1w': 604_800_000,
    '1m': 2_592_000_000,
  };

  it('returns the correct millisecond value for every delay variant', () => {
    for (const [delay, ms] of Object.entries(expected)) {
      expect(getRemovalDelayMs(delay as RemovalDelay)).toBe(ms);
    }
  });
});

// ─── formatRemovalDelay ─────────────────────────────────────────────────────

describe('formatRemovalDelay', () => {
  const expected: Record<RemovalDelay, string> = {
    immediate: 'Immediately',
    '1h': '1 hour',
    '12h': '12 hours',
    '24h': '24 hours',
    '3d': '3 days',
    '1w': '1 week',
    '1m': '1 month',
  };

  it('returns the correct human-readable label for every delay variant', () => {
    for (const [delay, label] of Object.entries(expected)) {
      expect(formatRemovalDelay(delay as RemovalDelay)).toBe(label);
    }
  });
});

// ─── formatRelativeTime ─────────────────────────────────────────────────────

describe('formatRelativeTime', () => {
  it('returns "just now" for less than 60 seconds ago', () => {
    const date = new Date(Date.now() - 30 * 1000);
    expect(formatRelativeTime(date)).toBe('just now');
  });

  it('returns minutes ago for less than 60 minutes', () => {
    const date = new Date(Date.now() - 5 * 60 * 1000);
    expect(formatRelativeTime(date)).toBe('5m ago');
  });

  it('returns hours ago for less than 24 hours', () => {
    const date = new Date(Date.now() - 3 * 60 * 60 * 1000);
    expect(formatRelativeTime(date)).toBe('3h ago');
  });

  it('returns days ago for less than 7 days', () => {
    const date = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(date)).toBe('2d ago');
  });
});

// ─── generateId ─────────────────────────────────────────────────────────────

describe('generateId', () => {
  it('returns a non-empty string', () => {
    const id = generateId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('returns unique values on successive calls', () => {
    const ids = new Set(Array.from({ length: 10 }, () => generateId()));
    expect(ids.size).toBe(10);
  });
});

// ─── generateInviteCode ─────────────────────────────────────────────────────

describe('generateInviteCode', () => {
  it('returns an 8-character string', () => {
    const code = generateInviteCode();
    expect(typeof code).toBe('string');
    expect(code.length).toBe(8);
  });
});
