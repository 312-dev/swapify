import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) redirect('/dashboard');

  return (
    <div className="min-h-screen gradient-bg-radial flex flex-col">
      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        {/* Spotify-style waveform decoration (CSS-only) */}
        <div className="flex items-end gap-1 mb-8 h-12">
          {[1, 2, 3, 4, 5, 4, 3, 2, 1].map((h, i) => (
            <div
              key={i}
              className="w-1 rounded-full bg-spotify/30"
              style={{
                height: `${h * 10}%`,
                animation: `pulse 1.5s ease-in-out ${i * 0.1}s infinite alternate`,
              }}
            />
          ))}
        </div>

        <h1
          className="text-5xl sm:text-7xl font-bold tracking-tight mb-4"
          style={{ textWrap: 'balance' }}
        >
          <span className="text-spotify">Swapify</span>
        </h1>

        <p
          className="text-xl sm:text-2xl text-text-secondary mb-2 max-w-md"
          style={{ textWrap: 'balance' }}
        >
          Collaborative playlists that clean themselves up.
        </p>

        <p className="text-base text-text-tertiary mb-10 max-w-sm" style={{ textWrap: 'balance' }}>
          Add tracks, listen together, and let played songs auto-clear. No stale playlists, ever.
        </p>

        <a
          href="/api/auth/login"
          className="btn-pill btn-pill-primary text-base px-10 py-3.5 shadow-lg shadow-spotify/20"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
          </svg>
          Get started with Spotify
        </a>
      </main>

      {/* How it works - horizontal scroll cards */}
      <section className="px-5 pb-12">
        <h2 className="text-base font-semibold text-text-tertiary uppercase tracking-wider mb-4">
          How it works
        </h2>
        <div className="flex gap-3 overflow-x-auto scrollbar-none pb-2 -mx-5 px-5">
          <div className="glass rounded-2xl p-5 min-w-[260px] flex-shrink-0">
            <div className="w-10 h-10 rounded-full bg-spotify/15 flex items-center justify-center text-spotify font-bold mb-3">
              1
            </div>
            <h3 className="font-semibold text-text-primary mb-1">Create a Swaplist</h3>
            <p className="text-base text-text-secondary">
              Start a collaborative playlist. Share the invite link with friends.
            </p>
          </div>
          <div className="glass rounded-2xl p-5 min-w-[260px] flex-shrink-0">
            <div className="w-10 h-10 rounded-full bg-spotify/15 flex items-center justify-center text-spotify font-bold mb-3">
              2
            </div>
            <h3 className="font-semibold text-text-primary mb-1">Add tracks together</h3>
            <p className="text-base text-text-secondary">
              Everyone adds songs they want the group to hear. Search or drag from Spotify.
            </p>
          </div>
          <div className="glass rounded-2xl p-5 min-w-[260px] flex-shrink-0">
            <div className="w-10 h-10 rounded-full bg-spotify/15 flex items-center justify-center text-spotify font-bold mb-3">
              3
            </div>
            <h3 className="font-semibold text-text-primary mb-1">Listen and clear</h3>
            <p className="text-base text-text-secondary">
              Play on Spotify. Once everyone&apos;s listened, the track auto-removes. Simple.
            </p>
          </div>
        </div>
      </section>

      <footer className="py-6 text-center text-sm text-text-tertiary">
        Swapify · Built with Spotify Web API
      </footer>
    </div>
  );
}
