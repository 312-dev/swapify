// Tab indices for directional slide on tab switches
const TAB_ORDER: Record<string, number> = {
  "/dashboard": 0,
  "/activity": 1,
  "/profile": 2,
};

function getRouteDepth(pathname: string): number {
  if (pathname in TAB_ORDER) return 0;
  if (/^\/jam\/[^/]+$/.test(pathname)) return 1;
  if (/^\/jam\/[^/]+\//.test(pathname)) return 2;
  return 0;
}

function getTabIndex(pathname: string): number | null {
  if (pathname.startsWith("/jam/")) return 0; // jam routes belong to dashboard tab
  return TAB_ORDER[pathname] ?? null;
}

export type TransitionDirection = "left" | "right" | "none";

export function getTransitionDirection(
  from: string | null,
  to: string
): TransitionDirection {
  if (!from || from === to) return "none";

  const fromDepth = getRouteDepth(from);
  const toDepth = getRouteDepth(to);

  // Drill down (e.g., /dashboard -> /jam/[id])
  if (toDepth > fromDepth) return "right";
  // Drill up (e.g., /jam/[id] -> /dashboard)
  if (toDepth < fromDepth) return "left";

  // Same depth: compare tab indices
  const fromTab = getTabIndex(from);
  const toTab = getTabIndex(to);

  if (fromTab !== null && toTab !== null) {
    if (toTab > fromTab) return "right";
    if (toTab < fromTab) return "left";
  }

  // Fallback for any other cross-page navigation
  return "right";
}
