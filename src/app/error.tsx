'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled error:', error);
  }, [error]);

  return (
    <div className="min-h-screen gradient-bg-radial flex flex-col items-center justify-center px-6 text-center">
      <div className="mb-6 flex items-center justify-center gap-3">
        <svg
          width="36"
          height="36"
          viewBox="0 0 512 512"
          fill="currentColor"
          className="shrink-0 text-brand drop-shadow-[0_0_14px_rgba(56,189,248,0.35)]"
          aria-hidden="true"
        >
          <g transform="translate(0,512) scale(0.1,-0.1)">
            <path d="M1483 5105 c-170 -46 -304 -181 -348 -350 -12 -47 -15 -123 -15 -372 l0 -313 -47 23 c-100 50 -152 62 -273 62 -94 0 -128 -4 -185 -23 -109 -36 -193 -88 -271 -167 -244 -247 -244 -643 1 -891 254 -257 657 -258 907 -1 l48 48 872 -386 873 -387 2 -111 c1 -62 3 -123 5 -137 3 -23 -51 -54 -802 -471 l-805 -447 -3 304 c-3 341 -1 351 64 400 l37 29 217 5 217 5 37 29 c71 54 85 151 32 221 -46 59 -72 65 -293 65 -217 0 -285 -11 -375 -56 -71 -36 -159 -123 -197 -193 -56 -106 -61 -143 -61 -488 l0 -313 -47 23 c-100 50 -152 62 -273 62 -94 0 -128 -4 -185 -23 -109 -36 -193 -88 -271 -167 -247 -249 -244 -645 6 -896 315 -316 845 -219 1032 190 39 85 58 189 58 324 l1 112 886 491 886 491 61 -49 c221 -179 520 -194 759 -39 117 77 203 189 255 333 l26 73 4 383 3 382 193 0 c258 0 332 22 455 136 113 104 169 270 144 419 -33 195 -192 359 -382 395 -80 15 -286 12 -359 -5 -175 -41 -311 -175 -357 -350 -12 -47 -15 -123 -15 -372 l0 -313 -42 21 c-213 109 -468 84 -665 -65 -35 -26 -73 -61 -87 -78 l-23 -30 -644 285 c-354 156 -749 331 -877 388 l-234 104 6 35 c3 19 6 187 6 373 l0 337 183 0 c200 0 271 11 359 56 65 33 164 132 200 200 145 271 -6 610 -307 689 -77 20 -318 20 -392 0z" />
          </g>
        </svg>
        <span className="text-2xl font-display text-text-primary tracking-tight">Swapify</span>
      </div>

      <h1 className="text-3xl font-display text-text-primary mb-3">Something went wrong</h1>
      <p className="text-text-secondary mb-8 max-w-xs" style={{ textWrap: 'balance' }}>
        An unexpected error occurred. Please try again.
      </p>

      {process.env.NODE_ENV === 'development' && error.message && (
        <div className="glass border-danger/30 rounded-xl p-4 mb-6 text-sm text-danger max-w-md w-full text-left font-mono break-words">
          {error.message}
        </div>
      )}

      <div className="flex flex-col items-center gap-3">
        <button
          onClick={reset}
          className="btn-pill btn-pill-primary text-base px-8 py-3 shadow-lg shadow-brand/20"
        >
          Try again
        </button>
        <Link
          href="/dashboard"
          className="text-sm text-text-tertiary hover:text-text-secondary transition-colors"
        >
          Back to Swaplists
        </Link>
      </div>
    </div>
  );
}
