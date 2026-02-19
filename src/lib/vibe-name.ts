import Anthropic from '@anthropic-ai/sdk';
import { db } from '@/db';
import { playlists } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import type { TrackVibeScore } from '@/lib/tunebat';

let client: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  client = new Anthropic({ apiKey });
  return client;
}

/**
 * Generate a Daylist-style vibe name for a playlist using Claude Haiku.
 *
 * Gracefully no-ops if ANTHROPIC_API_KEY is not set or < 4 tracks have scores.
 */
export async function generateAndSaveVibeName(
  playlistId: string,
  tracks: Array<{ trackName: string; artistName: string; spotifyTrackId: string }>,
  vibeScores: Map<string, TrackVibeScore>
): Promise<void> {
  const anthropic = getClient();
  if (!anthropic) return;

  const scoredTracks = tracks.filter((t) => vibeScores.has(t.spotifyTrackId));
  if (scoredTracks.length < 4) return;

  try {
    const vibeName = await generateVibeName(anthropic, scoredTracks, vibeScores);
    if (vibeName) {
      await db.update(playlists).set({ vibeName }).where(eq(playlists.id, playlistId));
    }
  } catch (error) {
    logger.error({ error, playlistId }, '[Swapify] Vibe name generation failed');
  }
}

async function generateVibeName(
  anthropic: Anthropic,
  tracks: Array<{ trackName: string; artistName: string; spotifyTrackId: string }>,
  vibeScores: Map<string, TrackVibeScore>
): Promise<string | null> {
  const scores = tracks
    .map((t) => vibeScores.get(t.spotifyTrackId))
    .filter(Boolean) as TrackVibeScore[];

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const avgEnergy = avg(scores.map((s) => s.energy));
  const avgDanceability = avg(scores.map((s) => s.danceability));
  const avgHappiness = avg(scores.map((s) => s.happiness));
  const avgBpm = avg(scores.map((s) => s.bpm));

  const trackSummary = tracks
    .slice(0, 15)
    .map((t) => `${t.trackName} by ${t.artistName}`)
    .join('\n');

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 30,
    messages: [
      {
        role: 'user',
        content: `You are a creative music curator. Based on the playlist's audio profile and track list below, generate a short, evocative vibe label in the style of Spotify's Daylist names.

Audio profile:
- Energy: ${avgEnergy.toFixed(2)} (0=calm, 1=intense)
- Danceability: ${avgDanceability.toFixed(2)} (0=still, 1=groovy)
- Happiness: ${avgHappiness.toFixed(2)} (0=melancholy, 1=euphoric)
- Average BPM: ${Math.round(avgBpm)}

Tracks:
${trackSummary}

Rules:
- 2-4 lowercase words, no punctuation
- Evocative and specific (not generic like "good vibes" or "chill music")
- Can reference mood, genre, energy, time of day, or aesthetic
- Examples: "mellow indie evening", "electric dance party", "hazy lo-fi warmth", "raw punk energy"

Respond with ONLY the vibe label, nothing else.`,
      },
    ],
  });

  const text = response.content[0]?.type === 'text' ? response.content[0].text.trim() : null;
  if (!text) return null;

  const cleaned = text
    .toLowerCase()
    .replace(/[^a-z\s-]/g, '')
    .trim();
  const wordCount = cleaned.split(/\s+/).length;
  if (cleaned && wordCount >= 2 && wordCount <= 5) {
    return cleaned;
  }

  return null;
}
