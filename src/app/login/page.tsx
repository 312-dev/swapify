import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect('/dashboard');

  const { error } = await searchParams;

  return (
    <div className="min-h-screen gradient-bg-radial flex flex-col items-center justify-center px-6">
      {/* Logo */}
      <div className="mb-8 flex items-center justify-center gap-3">
        <svg
          width="40"
          height="40"
          viewBox="0 0 512 512"
          fill="currentColor"
          className="shrink-0 text-brand drop-shadow-[0_0_14px_rgba(56,189,248,0.35)]"
          aria-hidden="true"
        >
          <g transform="translate(0,512) scale(0.1,-0.1)">
            <path d="M1483 5105 c-170 -46 -304 -181 -348 -350 -12 -47 -15 -123 -15 -372 l0 -313 -47 23 c-100 50 -152 62 -273 62 -94 0 -128 -4 -185 -23 -109 -36 -193 -88 -271 -167 -244 -247 -244 -643 1 -891 254 -257 657 -258 907 -1 l48 48 872 -386 873 -387 2 -111 c1 -62 3 -123 5 -137 3 -23 -51 -54 -802 -471 l-805 -447 -3 304 c-3 341 -1 351 64 400 l37 29 217 5 217 5 37 29 c71 54 85 151 32 221 -46 59 -72 65 -293 65 -217 0 -285 -11 -375 -56 -71 -36 -159 -123 -197 -193 -56 -106 -61 -143 -61 -488 l0 -313 -47 23 c-100 50 -152 62 -273 62 -94 0 -128 -4 -185 -23 -109 -36 -193 -88 -271 -167 -247 -249 -244 -645 6 -896 315 -316 845 -219 1032 190 39 85 58 189 58 324 l1 112 886 491 886 491 61 -49 c221 -179 520 -194 759 -39 117 77 203 189 255 333 l26 73 4 383 3 382 193 0 c258 0 332 22 455 136 113 104 169 270 144 419 -33 195 -192 359 -382 395 -80 15 -286 12 -359 -5 -175 -41 -311 -175 -357 -350 -12 -47 -15 -123 -15 -372 l0 -313 -42 21 c-213 109 -468 84 -665 -65 -35 -26 -73 -61 -87 -78 l-23 -30 -644 285 c-354 156 -749 331 -877 388 l-234 104 6 35 c3 19 6 187 6 373 l0 337 183 0 c200 0 271 11 359 56 65 33 164 132 200 200 145 271 -6 610 -307 689 -77 20 -318 20 -392 0z" />
          </g>
        </svg>
        <h1 className="text-4xl font-display text-text-primary tracking-tight">Swapify</h1>
      </div>

      <p className="text-text-secondary text-center mb-8 max-w-xs" style={{ textWrap: 'balance' }}>
        Connect your Spotify account to create and join collaborative playlists.
      </p>

      {error && (
        <div className="glass border-danger/30 rounded-xl p-4 mb-6 text-base text-danger max-w-sm w-full text-center">
          {error === 'no_code' && 'Login was cancelled.'}
          {error === 'no_verifier' && 'Session expired. Please try again.'}
          {error === 'token_exchange' && 'Failed to connect to Spotify.'}
          {error === 'no_client_id' &&
            'No Spotify app Client ID was provided. Please use an invite link or set up a Spotify app first.'}
          {error === 'dev_mode_user_limit' &&
            'This app is in development mode and has reached its user limit. Contact the developer for access.'}
          {![
            'no_code',
            'no_verifier',
            'token_exchange',
            'no_client_id',
            'dev_mode_user_limit',
          ].includes(error) && `Error: ${error}`}
        </div>
      )}

      <a
        href="/api/auth/login"
        className="btn-pill btn-pill-primary text-base px-10 py-3.5 shadow-lg shadow-brand/20"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
        </svg>
        Continue with Spotify
      </a>

      <p className="text-sm text-text-tertiary mt-6 text-center">
        We only access your listening history and playlists.
      </p>
    </div>
  );
}
