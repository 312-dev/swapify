// Transition types:
// - "fade": quick crossfade for lateral tab switches (siblings)
// - "slide-right": drill deeper (e.g., dashboard → playlist detail)
// - "slide-left": drill back (e.g., playlist detail → dashboard)
// - "none": same route, no animation

const TAB_ROUTES = new Set(['/dashboard', '/activity', '/profile']);

function getRouteDepth(pathname: string): number {
  if (TAB_ROUTES.has(pathname)) return 0;
  if (/^\/playlist\/[^/]+$/.test(pathname)) return 1;
  if (/^\/playlist\/[^/]+\//.test(pathname)) return 2;
  return 0;
}

export type TransitionType = 'fade' | 'slide-left' | 'slide-right' | 'none';

export function getTransitionType(from: string | null, to: string): TransitionType {
  if (!from || from === to) return 'none';

  const fromDepth = getRouteDepth(from);
  const toDepth = getRouteDepth(to);

  // Drill down (e.g., /dashboard -> /playlist/[id])
  if (toDepth > fromDepth) return 'slide-right';
  // Drill up (e.g., /playlist/[id] -> /dashboard)
  if (toDepth < fromDepth) return 'slide-left';

  // Same depth: lateral tab switch → crossfade
  return 'fade';
}
