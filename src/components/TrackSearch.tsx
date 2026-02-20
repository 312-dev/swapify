'use client';

import { useState } from 'react';
import GlassDrawer from '@/components/ui/glass-drawer';

interface TrackSearchProps {
  readonly spotifyPlaylistId: string;
}

export default function TrackSearch({ spotifyPlaylistId }: Readonly<TrackSearchProps>) {
  const [showModal, setShowModal] = useState(false);

  const spotifyUri = `spotify:playlist:${spotifyPlaylistId}`;

  function openSpotify() {
    globalThis.location.href = spotifyUri;
    setShowModal(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="w-full flex items-center justify-center gap-2 py-3 bg-glass border border-glass-border rounded-xl text-sm font-medium text-text-secondary backdrop-blur-sm transition-colors active:scale-[0.98]"
      >
        <svg className="w-4 h-4 text-[#1DB954]" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
        </svg>
        Add songs in Spotify
      </button>

      <GlassDrawer isOpen={showModal} onClose={() => setShowModal(false)} snapPoint="half">
        <div className="flex flex-col items-center text-center gap-6 py-4">
          <div className="w-16 h-16 rounded-full bg-[#1DB954]/15 flex items-center justify-center">
            <svg className="w-8 h-8 text-[#1DB954]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
            </svg>
          </div>

          <div className="space-y-2">
            <p className="text-text-primary text-lg font-medium">Add songs in Spotify</p>
            <p className="text-text-secondary text-sm leading-relaxed max-w-70">
              Search for songs and add them directly to the playlist in the Spotify app.
              They&apos;ll sync here automatically.
            </p>
          </div>

          <div className="flex flex-col gap-3 w-full max-w-70">
            <button
              type="button"
              onClick={openSpotify}
              className="btn-pill btn-pill-primary flex items-center justify-center gap-2 py-3"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
              </svg>
              Open Spotify
            </button>
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="btn-pill btn-pill-secondary py-3"
            >
              Cancel
            </button>
          </div>
        </div>
      </GlassDrawer>
    </>
  );
}
