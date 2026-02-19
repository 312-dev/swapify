import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { nanoid } from 'nanoid';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId(): string {
  return nanoid();
}

export function generateInviteCode(): string {
  return nanoid(8);
}

/**
 * Format a Swapify playlist name.
 * 1-3 members: "J+S Swapify" (first initials)
 * >3 members: requires a groupName (max 15 chars) → "GROUPNAME Swapify"
 */
export function formatPlaylistName(memberNames: string[], groupName?: string): string {
  if (memberNames.length === 0) return 'Swapify';

  if (groupName) {
    return `${groupName.slice(0, 15)} Swapify`;
  }

  const initials = memberNames.map((n) => n[0]!.toUpperCase()).join('+');
  return `${initials} Swapify`;
}

export function suggestGroupNames(): string[] {
  return ['Squad', 'Our', 'The Crew', 'Homies', 'Fam', 'Gang', 'Team', 'Club'];
}

export function needsGroupName(memberCount: number): boolean {
  return memberCount > 3;
}

export function getFirstName(displayName: string): string {
  return displayName.split(' ')[0] ?? displayName;
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

// ─── Removal Delay ──────────────────────────────────────────────────────────

export type RemovalDelay = 'immediate' | '1h' | '12h' | '24h' | '3d' | '1w' | '1m';

const REMOVAL_DELAY_MS: Record<RemovalDelay, number> = {
  immediate: 0,
  '1h': 1 * 60 * 60 * 1000,
  '12h': 12 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '3d': 3 * 24 * 60 * 60 * 1000,
  '1w': 7 * 24 * 60 * 60 * 1000,
  '1m': 30 * 24 * 60 * 60 * 1000,
};

export const VALID_REMOVAL_DELAYS = Object.keys(REMOVAL_DELAY_MS) as RemovalDelay[];

export function getRemovalDelayMs(delay: RemovalDelay): number {
  return REMOVAL_DELAY_MS[delay] ?? 0;
}

export function formatRemovalDelay(delay: RemovalDelay): string {
  const labels: Record<RemovalDelay, string> = {
    immediate: 'Immediately',
    '1h': '1 hour',
    '12h': '12 hours',
    '24h': '24 hours',
    '3d': '3 days',
    '1w': '1 week',
    '1m': '1 month',
  };
  return labels[delay] ?? 'Immediately';
}

export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(date);
}
