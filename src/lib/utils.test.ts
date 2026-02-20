import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  cn,
  generateId,
  generateInviteCode,
  formatPlaylistName,
  needsGroupName,
  getFirstName,
  formatDate,
  getRemovalDelayMs,
  formatRemovalDelay,
  VALID_REMOVAL_DELAYS,
  formatRelativeTime,
} from './utils';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible');
  });

  it('deduplicates tailwind classes via twMerge', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2');
  });

  it('returns empty string for no inputs', () => {
    expect(cn()).toBe('');
  });

  it('handles arrays and objects', () => {
    expect(cn(['a', 'b'], { c: true, d: false })).toBe('a b c');
  });
});

describe('generateId', () => {
  it('returns a non-empty string', () => {
    const id = generateId();
    expect(id).toBeTruthy();
    expect(typeof id).toBe('string');
  });

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateId()));
    expect(ids.size).toBe(50);
  });

  it('returns nanoid default length (21 characters)', () => {
    expect(generateId()).toHaveLength(21);
  });
});

describe('generateInviteCode', () => {
  it('returns an 8-character string', () => {
    expect(generateInviteCode()).toHaveLength(8);
  });

  it('returns a lowercase string', () => {
    const code = generateInviteCode();
    expect(code).toBe(code.toLowerCase());
  });

  it('generates unique codes', () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateInviteCode()));
    expect(codes.size).toBe(50);
  });
});

describe('formatPlaylistName', () => {
  it('returns "Swapify" for empty members', () => {
    expect(formatPlaylistName([])).toBe('Swapify');
  });

  it('formats single member with initial', () => {
    expect(formatPlaylistName(['Alice'])).toBe('A Swapify');
  });

  it('formats two members with initials joined by +', () => {
    expect(formatPlaylistName(['Alice', 'Bob'])).toBe('A+B Swapify');
  });

  it('formats three members with initials joined by +', () => {
    expect(formatPlaylistName(['Alice', 'Bob', 'Charlie'])).toBe('A+B+C Swapify');
  });

  it('uppercases initials from lowercase names', () => {
    expect(formatPlaylistName(['alice', 'bob'])).toBe('A+B Swapify');
  });

  it('uses group name when provided', () => {
    expect(formatPlaylistName(['Alice', 'Bob', 'Charlie', 'Dave'], 'Squad')).toBe('Squad Swapify');
  });

  it('truncates group name to 15 characters', () => {
    const longName = 'ThisIsAReallyLongGroupName';
    const result = formatPlaylistName(['A', 'B', 'C', 'D'], longName);
    expect(result).toBe('ThisIsAReallyLo Swapify');
  });

  it('uses group name even for small member count if provided', () => {
    expect(formatPlaylistName(['Alice'], 'MyJam')).toBe('MyJam Swapify');
  });
});

describe('needsGroupName', () => {
  it('returns false for 0 members', () => {
    expect(needsGroupName(0)).toBe(false);
  });

  it('returns false for 1 member', () => {
    expect(needsGroupName(1)).toBe(false);
  });

  it('returns false for 3 members', () => {
    expect(needsGroupName(3)).toBe(false);
  });

  it('returns true for 4 members', () => {
    expect(needsGroupName(4)).toBe(true);
  });

  it('returns true for 10 members', () => {
    expect(needsGroupName(10)).toBe(true);
  });
});

describe('getFirstName', () => {
  it('returns first name from full name', () => {
    expect(getFirstName('John Doe')).toBe('John');
  });

  it('returns the whole string if no space', () => {
    expect(getFirstName('Alice')).toBe('Alice');
  });

  it('handles multiple spaces', () => {
    expect(getFirstName('John Michael Doe')).toBe('John');
  });

  it('handles empty string', () => {
    expect(getFirstName('')).toBe('');
  });
});

describe('formatDate', () => {
  it('formats a date in en-US short format', () => {
    // Use noon UTC to avoid timezone offset changing the day
    const date = new Date('2024-03-15T12:00:00Z');
    const result = formatDate(date);
    // Intl format: "Mar 15, 2024"
    expect(result).toContain('Mar');
    expect(result).toContain('15');
    expect(result).toContain('2024');
  });

  it('formats another date correctly', () => {
    const date = new Date('2025-12-25T12:00:00Z');
    const result = formatDate(date);
    expect(result).toContain('Dec');
    expect(result).toContain('25');
    expect(result).toContain('2025');
  });
});

describe('getRemovalDelayMs', () => {
  it('returns 0 for immediate', () => {
    expect(getRemovalDelayMs('immediate')).toBe(0);
  });

  it('returns correct ms for 1h', () => {
    expect(getRemovalDelayMs('1h')).toBe(3_600_000);
  });

  it('returns correct ms for 12h', () => {
    expect(getRemovalDelayMs('12h')).toBe(43_200_000);
  });

  it('returns correct ms for 24h', () => {
    expect(getRemovalDelayMs('24h')).toBe(86_400_000);
  });

  it('returns correct ms for 3d', () => {
    expect(getRemovalDelayMs('3d')).toBe(259_200_000);
  });

  it('returns correct ms for 1w', () => {
    expect(getRemovalDelayMs('1w')).toBe(604_800_000);
  });

  it('returns correct ms for 1m', () => {
    expect(getRemovalDelayMs('1m')).toBe(2_592_000_000);
  });
});

describe('formatRemovalDelay', () => {
  it('returns "Immediately" for immediate', () => {
    expect(formatRemovalDelay('immediate')).toBe('Immediately');
  });

  it('returns "1 hour" for 1h', () => {
    expect(formatRemovalDelay('1h')).toBe('1 hour');
  });

  it('returns "12 hours" for 12h', () => {
    expect(formatRemovalDelay('12h')).toBe('12 hours');
  });

  it('returns "24 hours" for 24h', () => {
    expect(formatRemovalDelay('24h')).toBe('24 hours');
  });

  it('returns "3 days" for 3d', () => {
    expect(formatRemovalDelay('3d')).toBe('3 days');
  });

  it('returns "1 week" for 1w', () => {
    expect(formatRemovalDelay('1w')).toBe('1 week');
  });

  it('returns "1 month" for 1m', () => {
    expect(formatRemovalDelay('1m')).toBe('1 month');
  });
});

describe('VALID_REMOVAL_DELAYS', () => {
  it('contains all seven delay keys', () => {
    expect(VALID_REMOVAL_DELAYS).toHaveLength(7);
    expect(VALID_REMOVAL_DELAYS).toContain('immediate');
    expect(VALID_REMOVAL_DELAYS).toContain('1h');
    expect(VALID_REMOVAL_DELAYS).toContain('12h');
    expect(VALID_REMOVAL_DELAYS).toContain('24h');
    expect(VALID_REMOVAL_DELAYS).toContain('3d');
    expect(VALID_REMOVAL_DELAYS).toContain('1w');
    expect(VALID_REMOVAL_DELAYS).toContain('1m');
  });
});

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "just now" for less than 60 seconds ago', () => {
    const date = new Date('2025-06-15T11:59:30Z'); // 30s ago
    expect(formatRelativeTime(date)).toBe('just now');
  });

  it('returns minutes ago for less than 60 minutes', () => {
    const date = new Date('2025-06-15T11:45:00Z'); // 15m ago
    expect(formatRelativeTime(date)).toBe('15m ago');
  });

  it('returns hours ago for less than 24 hours', () => {
    const date = new Date('2025-06-15T06:00:00Z'); // 6h ago
    expect(formatRelativeTime(date)).toBe('6h ago');
  });

  it('returns days ago for less than 7 days', () => {
    const date = new Date('2025-06-12T12:00:00Z'); // 3d ago
    expect(formatRelativeTime(date)).toBe('3d ago');
  });

  it('returns formatted date for 7+ days ago', () => {
    const date = new Date('2025-06-01T12:00:00Z'); // 14d ago
    const result = formatRelativeTime(date);
    expect(result).toContain('Jun');
    expect(result).toContain('2025');
  });

  it('returns "just now" for 0 seconds difference', () => {
    const date = new Date('2025-06-15T12:00:00Z');
    expect(formatRelativeTime(date)).toBe('just now');
  });

  it('returns "1m ago" at exactly 60 seconds', () => {
    const date = new Date('2025-06-15T11:59:00Z'); // exactly 60s ago
    expect(formatRelativeTime(date)).toBe('1m ago');
  });

  it('returns "1h ago" at exactly 60 minutes', () => {
    const date = new Date('2025-06-15T11:00:00Z'); // exactly 60m ago
    expect(formatRelativeTime(date)).toBe('1h ago');
  });

  it('returns "1d ago" at exactly 24 hours', () => {
    const date = new Date('2025-06-14T12:00:00Z'); // exactly 24h ago
    expect(formatRelativeTime(date)).toBe('1d ago');
  });
});
