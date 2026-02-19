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
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-spotify">Swapify</h1>
      </div>

      <p className="text-text-secondary text-center mb-8 max-w-xs" style={{ textWrap: 'balance' }}>
        Connect your Spotify account to create and join collaborative playlists.
      </p>

      {error && (
        <div className="glass border-danger/30 rounded-xl p-4 mb-6 text-base text-danger max-w-sm w-full text-center">
          {error === 'no_code' && 'Login was cancelled.'}
          {error === 'no_verifier' && 'Session expired. Please try again.'}
          {error === 'token_exchange' && 'Failed to connect to Spotify.'}
          {!['no_code', 'no_verifier', 'token_exchange'].includes(error) && `Error: ${error}`}
        </div>
      )}

      <a
        href="/api/auth/login"
        className="btn-pill btn-pill-primary text-base px-10 py-3.5 shadow-lg shadow-spotify/20"
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
