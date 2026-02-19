'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const AUTHENTICATED_PREFIXES = ['/dashboard', '/activity', '/profile', '/playlist'];

function GridIcon({ className }: { className?: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function ActivityIcon({ className }: { className?: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function ProfileIcon({ className }: { className?: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M20 21a8 8 0 1 0-16 0" />
    </svg>
  );
}

const tabs = [
  { label: 'Swaplists', href: '/dashboard', icon: GridIcon },
  { label: 'Activity', href: '/activity', icon: ActivityIcon },
  { label: 'Profile', href: '/profile', icon: ProfileIcon },
] as const;

function getActiveTab(pathname: string): string {
  if (pathname === '/activity') return '/activity';
  if (pathname === '/profile' || pathname.startsWith('/profile/')) return '/profile';
  // Everything else on authenticated paths defaults to "Swaplists"
  return '/dashboard';
}

export default function BottomNav() {
  const pathname = usePathname();

  const isAuthenticatedPath = AUTHENTICATED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (!isAuthenticatedPath) return null;

  const activeTab = getActiveTab(pathname);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-t border-white/[0.08] pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-16">
        {tabs.map(({ label, href, icon: Icon }) => {
          const isActive = activeTab === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors duration-200 ${
                isActive ? 'text-spotify' : 'text-text-secondary'
              }`}
            >
              <Icon />
              <span className="text-xs font-medium mt-1">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
