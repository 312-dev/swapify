'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'motion/react';
import { springs } from '@/lib/motion';

const AUTHENTICATED_PREFIXES = ['/dashboard', '/activity', '/profile', '/playlist', '/circle'];

/* ── Animated logo wordmark (hover loop) ── */

const LOGO_LETTERS = ['S', 'w', 'a', 'p', 'i', 'f', 'y'];
const LAST_IDX = LOGO_LETTERS.length - 1;
const STAGGER_IN = 0.18;
const DROP_IN_DURATION = 0.8;
const HOLD_MS = 2000;
const STAGGER_OUT = 0.14;
const FALL_DURATION = 0.7;

import { useEffect } from 'react';

function NavLogoWordmark({ hovering }: { hovering: boolean }) {
  const [phase, setPhase] = useState<'static' | 'drop' | 'fall'>('static');
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (hovering) {
      setCycle((c) => c + 1); // eslint-disable-line react-hooks/set-state-in-effect -- sync with hover
      setPhase('drop');
    } else {
      setPhase('static');
    }
  }, [hovering]);

  useEffect(() => {
    if (!hovering || phase === 'static') return;

    if (phase === 'drop') {
      const totalDrop = (DROP_IN_DURATION + LAST_IDX * STAGGER_IN) * 1000 + HOLD_MS;
      const t = setTimeout(() => setPhase('fall'), totalDrop);
      return () => clearTimeout(t);
    }
    if (phase === 'fall') {
      const totalFall = (FALL_DURATION + LAST_IDX * STAGGER_OUT) * 1000 + 500;
      const t = setTimeout(() => {
        setCycle((c) => c + 1);
        setPhase('drop');
      }, totalFall);
      return () => clearTimeout(t);
    }
  }, [phase, hovering]);

  if (phase === 'static') {
    return <span className="font-display text-2xl text-white">Swapify</span>;
  }

  return (
    <span key={cycle} className="overflow-hidden h-8 flex items-center">
      <span className="flex">
        {LOGO_LETTERS.map((letter, i) => {
          const reverseIdx = LAST_IDX - i;
          return (
            <motion.span
              key={i}
              className="font-display text-2xl text-white inline-block"
              style={{ transformOrigin: 'bottom center' }}
              initial={{ y: -28, rotate: -16, opacity: 0 }}
              animate={
                phase === 'drop'
                  ? { y: 0, rotate: 0, opacity: 1 }
                  : { y: 36, rotate: 20 + reverseIdx * 3, opacity: 0 }
              }
              transition={
                phase === 'drop'
                  ? {
                      delay: i * STAGGER_IN,
                      duration: DROP_IN_DURATION,
                      ease: [0.34, 1.56, 0.64, 1] as const,
                    }
                  : {
                      delay: reverseIdx * STAGGER_OUT,
                      duration: FALL_DURATION,
                      ease: [0.55, 0, 1, 0.45] as const,
                    }
              }
            >
              {letter}
            </motion.span>
          );
        })}
      </span>
    </span>
  );
}

interface TopNavProps {
  user?: {
    displayName: string;
    avatarUrl: string | null;
  };
}

export default function TopNav({ user }: TopNavProps) {
  const pathname = usePathname();
  const [logoHovered, setLogoHovered] = useState(false);

  const isAuthenticatedPath = AUTHENTICATED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (!isAuthenticatedPath) return null;

  return (
    <nav
      className="fixed top-0 left-0 w-screen z-50 bg-black/80 backdrop-blur-xl border-b border-white/8 pt-[env(safe-area-inset-top)]"
      data-tour="top-nav"
    >
      <div className="relative flex items-center justify-center h-16 max-w-2xl mx-auto w-full px-4 sm:max-w-4xl sm:px-6">
        {/* Logo — centered */}
        <Link
          href="/dashboard"
          className="flex items-center gap-3"
          onMouseEnter={() => setLogoHovered(true)}
          onMouseLeave={() => setLogoHovered(false)}
        >
          <Image src="/icons/swapify-logo.svg" alt="" width={28} height={28} className="w-7 h-7" />
          <NavLogoWordmark hovering={logoHovered} />
        </Link>

        {/* Profile avatar — pinned right */}
        {user && (
          <Link href="/profile" aria-label="Profile" className="absolute right-4 sm:right-6">
            <motion.div whileTap={{ scale: 0.9 }} transition={springs.snappy}>
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.displayName}
                  className="w-8 h-8 rounded-full object-cover ring-2 ring-white/10 hover:ring-brand/50 transition-all"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-medium text-text-secondary ring-2 ring-white/10 hover:ring-brand/50 transition-all">
                  {user.displayName[0]}
                </div>
              )}
            </motion.div>
          </Link>
        )}
      </div>
    </nav>
  );
}
