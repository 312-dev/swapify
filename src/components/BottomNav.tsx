'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ListMusic } from 'lucide-react';
import { motion } from 'motion/react';
import { useUnreadActivity } from '@/components/UnreadActivityProvider';
import { springs } from '@/lib/motion';

const AUTHENTICATED_PREFIXES = ['/dashboard', '/activity', '/profile', '/playlist', '/circle'];

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
  { label: 'Swaplists', href: '/dashboard', icon: ListMusic },
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
  const { unreadCount } = useUnreadActivity();

  const isAuthenticatedPath = AUTHENTICATED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (!isAuthenticatedPath) return null;

  const activeTab = getActiveTab(pathname);

  return (
    <nav
      className="fixed left-0 right-0 z-50 bg-black/80 backdrop-blur-xl bottom-0 border-t border-white/[0.08] pb-[env(safe-area-inset-bottom)] sm:top-0 sm:bottom-auto sm:border-t-0 sm:border-b sm:border-white/[0.08] sm:pb-0"
      data-tour="bottom-nav"
    >
      <div className="flex items-center justify-around h-16 max-w-2xl mx-auto w-full sm:justify-center sm:gap-2">
        {tabs.map(({ label, href, icon: Icon }) => {
          const isActive = activeTab === href;
          const showBadge = href === '/activity' && unreadCount > 0;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center justify-center transition-colors duration-200 flex-col flex-1 h-full sm:flex-row sm:flex-initial sm:gap-2 sm:px-5 sm:rounded-lg sm:h-10 sm:hover:bg-white/[0.06] ${
                isActive ? 'text-brand' : 'text-text-secondary'
              }`}
            >
              <motion.span
                className="relative"
                style={{ willChange: 'transform' }}
                whileTap={{ scale: 0.82 }}
                transition={springs.snappy}
              >
                <Icon />
                {showBadge && (
                  <span className="absolute -top-1 -right-1.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-brand text-[10px] font-bold text-white leading-none">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </motion.span>
              <span className="text-xs font-medium mt-1 sm:mt-0 sm:text-sm">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
