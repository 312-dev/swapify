'use client';

import { usePathname } from 'next/navigation';
import { LazyMotion, domAnimation } from 'motion/react';
import BottomNav from './BottomNav';
import TooltipProvider from './TooltipProvider';
import PageTransition from './PageTransition';
import { TransitionDirectionProvider } from '@/lib/TransitionContext';
import UnreadActivityProvider from './UnreadActivityProvider';

const AUTHENTICATED_PREFIXES = ['/dashboard', '/activity', '/profile', '/playlist', '/circle'];

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const showBottomNav = AUTHENTICATED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  return (
    <LazyMotion features={domAnimation}>
      <TransitionDirectionProvider>
        <UnreadActivityProvider>
          <div className={showBottomNav ? 'pb-20 sm:pb-0 sm:pt-20' : ''}>
            {showBottomNav ? (
              <div className="max-w-2xl mx-auto w-full">
                <PageTransition>{children}</PageTransition>
              </div>
            ) : (
              children
            )}
          </div>
          <BottomNav />
          <TooltipProvider />
        </UnreadActivityProvider>
      </TransitionDirectionProvider>
    </LazyMotion>
  );
}
