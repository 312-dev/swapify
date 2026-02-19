'use client';

import { useState, useEffect, useRef } from 'react';
import AlbumArt from '@/components/AlbumArt';
import { toast } from 'sonner';

interface SearchTrack {
  id: string;
  uri: string;
  name: string;
  duration_ms: number;
  artists: Array<{ id: string; name: string }>;
  album: {
    id: string;
    name: string;
    images: Array<{ url: string }>;
  };
}

interface TrackSearchProps {
  playlistId: string;
  onTrackAdded: () => void;
}

export default function TrackSearch({ playlistId, onTrackAdded }: TrackSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchTrack[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addingUri, setAddingUri] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.tracks || []);
        setShowResults(true);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function addTrack(track: SearchTrack) {
    setAddingUri(track.uri);
    try {
      const res = await fetch(`/api/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spotifyTrackUri: track.uri,
          spotifyTrackId: track.id,
          trackName: track.name,
          artistName: track.artists.map((a) => a.name).join(', '),
          albumName: track.album.name,
          albumImageUrl: track.album.images[0]?.url || null,
          durationMs: track.duration_ms,
        }),
      });

      if (res.ok) {
        setQuery('');
        setResults([]);
        setShowResults(false);
        onTrackAdded();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to add track');
      }
    } catch {
      toast.error('Failed to add track');
    } finally {
      setAddingUri(null);
    }
  }

  function formatDuration(ms: number): string {
    const min = Math.floor(ms / 60000);
    const sec = Math.floor((ms % 60000) / 1000);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary z-10 pointer-events-none"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setShowResults(true)}
          placeholder="Search for a track to add..."
          className="w-full pl-10 pr-4 py-3 bg-glass border border-glass-border rounded-xl text-base text-text-primary placeholder:text-text-tertiary backdrop-blur-sm focus:outline-none focus:border-spotify transition-colors"
        />
        {isSearching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-text-tertiary border-t-spotify rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Search results dropdown */}
      {showResults && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 rounded-xl shadow-2xl border border-white/8 max-h-80 overflow-y-auto z-50 bg-[#181818]">
          {results.map((track) => (
            <button
              key={track.id}
              onClick={() => addTrack(track)}
              disabled={addingUri === track.uri}
              className="w-full flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl transition-colors text-left disabled:opacity-50"
            >
              <AlbumArt
                src={track.album.images[0]?.url}
                alt={track.album.name}
                className="w-10 h-10 rounded-lg"
              />
              <div className="flex-1 min-w-0">
                <p className="text-base font-medium text-text-primary truncate">{track.name}</p>
                <p className="text-sm text-text-secondary truncate">
                  {track.artists.map((a) => a.name).join(', ')} &middot; {track.album.name}
                </p>
              </div>
              <span className="text-sm text-text-tertiary shrink-0">
                {addingUri === track.uri ? 'Adding...' : formatDuration(track.duration_ms)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
