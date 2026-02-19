import { nanoid } from "nanoid";

export function generateId(): string {
  return nanoid();
}

export function generateInviteCode(): string {
  return nanoid(8);
}

/**
 * Format a Deep Digs playlist name.
 * 1-3 members: "J+S Deep Digs" (first initials)
 * >3 members: requires a groupName (max 15 chars) → "GROUPNAME Deep Digs"
 */
export function formatDigName(
  memberNames: string[],
  groupName?: string
): string {
  if (memberNames.length === 0) return "Deep Digs";

  if (groupName) {
    return `${groupName.slice(0, 15)} Deep Digs`;
  }

  const initials = memberNames.map((n) => n[0].toUpperCase()).join("+");
  return `${initials} Deep Digs`;
}

export function suggestGroupNames(): string[] {
  return ["Squad", "Our", "The Crew", "Homies", "Fam", "Gang", "Team", "Club"];
}

export function needsGroupName(memberCount: number): boolean {
  return memberCount > 3;
}

export function getFirstName(displayName: string): string {
  return displayName.split(" ")[0];
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(date);
}

export function classNames(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
