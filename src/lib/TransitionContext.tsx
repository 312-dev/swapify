'use client';

import { createContext, useContext, useRef, useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { getTransitionType, type TransitionType } from './transition';

const TransitionContext = createContext<TransitionType>('none');

export function useTransitionType() {
  return useContext(TransitionContext);
}

export function TransitionDirectionProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const prevPathRef = useRef<string | null>(null);
  const [type, setType] = useState<TransitionType>('none');

  useEffect(() => {
    setType(getTransitionType(prevPathRef.current, pathname));
    prevPathRef.current = pathname;
  }, [pathname]);

  return <TransitionContext.Provider value={type}>{children}</TransitionContext.Provider>;
}
