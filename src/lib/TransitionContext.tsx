"use client";

import { createContext, useContext, useRef, useMemo } from "react";
import { usePathname } from "next/navigation";
import {
  getTransitionDirection,
  type TransitionDirection,
} from "./transition";

const TransitionContext = createContext<TransitionDirection>("none");

export function useTransitionDirection() {
  return useContext(TransitionContext);
}

export function TransitionDirectionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const prevPathRef = useRef<string | null>(null);

  const direction = useMemo(() => {
    const dir = getTransitionDirection(prevPathRef.current, pathname);
    prevPathRef.current = pathname;
    return dir;
  }, [pathname]);

  return (
    <TransitionContext.Provider value={direction}>
      {children}
    </TransitionContext.Provider>
  );
}
