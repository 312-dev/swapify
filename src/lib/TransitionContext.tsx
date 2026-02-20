'use client';

import { createContext, useContext, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getTransitionType, type TransitionType } from './transition';

const TransitionContext = createContext<TransitionType>('none');

export function useTransitionType() {
  return useContext(TransitionContext);
}

export function TransitionDirectionProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [state, setState] = useState({ path: pathname, type: 'none' as TransitionType });

  // Compute transition type synchronously during render (derived state pattern).
  // This avoids the one-render-behind lag that useEffect would cause.
  if (pathname !== state.path) {
    setState({ path: pathname, type: getTransitionType(state.path, pathname) });
  }

  return <TransitionContext.Provider value={state.type}>{children}</TransitionContext.Provider>;
}
