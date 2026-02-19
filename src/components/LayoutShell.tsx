"use client";

import { usePathname } from "next/navigation";
import { LazyMotion, domAnimation } from "motion/react";
import BottomNav from "./BottomNav";
import TooltipProvider from "./TooltipProvider";
import PageTransition from "./PageTransition";
import { TransitionDirectionProvider } from "@/lib/TransitionContext";

const AUTHENTICATED_PREFIXES = ["/dashboard", "/activity", "/profile", "/jam"];

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const showBottomNav = AUTHENTICATED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  return (
    <LazyMotion features={domAnimation}>
      <TransitionDirectionProvider>
        <div className={`overflow-x-hidden ${showBottomNav ? "pb-20" : ""}`}>
          {showBottomNav ? (
            <PageTransition>{children}</PageTransition>
          ) : (
            children
          )}
        </div>
        <BottomNav />
        <TooltipProvider />
      </TransitionDirectionProvider>
    </LazyMotion>
  );
}
