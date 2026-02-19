const TUNEBAT_API = 'https://api.tunebat.com/api/tracks/search';

export interface TunebatTrack {
  id: string; // Spotify track ID
  n: string; // Track name
  as: string[]; // Artists
  b: number; // BPM
  da: number; // Danceability (0-1)
  e: number; // Energy (0-1)
  h: number; // Happiness/Valence (0-1)
}

export interface TrackVibeScore {
  spotifyTrackId: string;
  energy: number;
  danceability: number;
  happiness: number;
  bpm: number;
  score: number;
}

/**
 * Search Tunebat for a track and return audio features.
 * Matches results by Spotify track ID for accuracy.
 */
async function searchTunebat(query: string): Promise<TunebatTrack[]> {
  const url = `${TUNEBAT_API}?term=${encodeURIComponent(query)}`;
  const res = await fetch(url);

  if (!res.ok) {
    const retryAfter = res.headers.get('retry-after');
    if (retryAfter) {
      const waitSec = parseInt(retryAfter, 10) + 1;
      await new Promise((r) => setTimeout(r, waitSec * 1000));
      return searchTunebat(query);
    }
    throw new Error(`Tunebat search failed: ${res.status}`);
  }

  const text = await res.text();
  const data = JSON.parse(
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/'/g, "'")
  );
  return data.data?.items ?? [];
}

/**
 * Compute a vibe/excitement score from audio features.
 * Higher = more exciting, lower = calmer.
 */
function computeVibeScore(track: TunebatTrack): number {
  const normalizedTempo = Math.max(0, Math.min(1, (track.b - 60) / 140));
  return 0.4 * track.e + 0.25 * track.h + 0.25 * track.da + 0.1 * normalizedTempo;
}

/**
 * Get vibe scores for a list of tracks.
 * Searches Tunebat one at a time to respect rate limits (~15/min).
 */
export async function getVibeScores(
  tracks: Array<{ spotifyTrackId: string; trackName: string; artistName: string }>
): Promise<Map<string, TrackVibeScore>> {
  const scores = new Map<string, TrackVibeScore>();

  for (const track of tracks) {
    try {
      const results = await searchTunebat(`${track.artistName} ${track.trackName}`);
      const match = results.find((r) => r.id === track.spotifyTrackId);

      if (match) {
        scores.set(track.spotifyTrackId, {
          spotifyTrackId: track.spotifyTrackId,
          energy: match.e,
          danceability: match.da,
          happiness: match.h,
          bpm: match.b,
          score: computeVibeScore(match),
        });
      }
    } catch {
      // Skip tracks that fail — they'll be placed at the end
    }
  }

  return scores;
}
