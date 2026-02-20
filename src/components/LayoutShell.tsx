'use client';

import { usePathname } from 'next/navigation';
import { LazyMotion, domAnimation } from 'motion/react';
import TopNav from './BottomNav';
import TooltipProvider from './TooltipProvider';
import PageTransition from './PageTransition';
import { TransitionDirectionProvider } from '@/lib/TransitionContext';
import UnreadActivityProvider from './UnreadActivityProvider';

const AUTHENTICATED_PREFIXES = ['/dashboard', '/activity', '/profile', '/playlist', '/circle'];

interface LayoutShellProps {
  children: React.ReactNode;
  user?: {
    displayName: string;
    avatarUrl: string | null;
  };
}

export default function LayoutShell({ children, user }: Readonly<LayoutShellProps>) {
  const pathname = usePathname();

  const showNav = AUTHENTICATED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  return (
    <LazyMotion features={domAnimation}>
      <TransitionDirectionProvider>
        <UnreadActivityProvider>
          <div className={showNav ? 'pt-14' : ''}>
            {showNav ? (
              <div className="max-w-2xl sm:max-w-4xl mx-auto w-full">
                <PageTransition>{children}</PageTransition>
              </div>
            ) : (
              children
            )}
          </div>
          <TopNav user={user} />
          <TooltipProvider />
        </UnreadActivityProvider>
      </TransitionDirectionProvider>
    </LazyMotion>
  );
}
