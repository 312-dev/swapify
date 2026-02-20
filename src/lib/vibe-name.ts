import Anthropic from '@anthropic-ai/sdk';
import { db } from '@/db';
import { playlists } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { updatePlaylistDetails, isRateLimited } from '@/lib/spotify';
import { spotifyConfig, isOverBudget } from '@/lib/spotify-config';
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
      // Fire-and-forget: sync new vibe to Spotify description (throttled)
      syncVibeToSpotify(playlistId).catch(() => {});
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

// ─── Vibe Description Helpers ────────────────────────────────────────────────

/** Delimiter used to separate user description from the vibe label on Spotify. */
const VIBE_DELIMITER = '\n\n🎵 vibe: ';

/**
 * Compose the full Spotify playlist description from the user's description
 * and the auto-generated vibe name. The vibe is appended as a suffix that
 * looks nice on Spotify but can be stripped when reading back.
 */
export function buildSpotifyDescription(
  userDescription: string | null | undefined,
  vibeName: string | null | undefined
): string {
  const base = userDescription || 'A Swapify shared playlist — songs in, listens out';
  if (!vibeName) return base;
  return `${base}${VIBE_DELIMITER}${vibeName}`;
}

/**
 * Strip the vibe suffix from a Spotify description, returning only the
 * user-authored portion. Safe to call on descriptions that don't have a vibe.
 */
export function stripVibeFromDescription(spotifyDescription: string | null): string | null {
  if (!spotifyDescription) return null;
  const idx = spotifyDescription.indexOf(VIBE_DELIMITER);
  if (idx === -1) return spotifyDescription;
  const stripped = spotifyDescription.substring(0, idx).trim();
  return stripped || null;
}

/**
 * Sync the current vibe name to the Spotify playlist description.
 * Respects rate limits and throttles updates to avoid hammering the API.
 *
 * Called automatically after vibe name generation. The Spotify description
 * is composed as: "{user description}\n\n🎵 vibe: {vibeName}"
 */
export async function syncVibeToSpotify(playlistId: string): Promise<void> {
  if (isRateLimited() || isOverBudget()) return;

  const playlist = await db.query.playlists.findFirst({
    where: eq(playlists.id, playlistId),
  });
  if (!playlist || !playlist.vibeName) return;

  // Throttle: don't sync more often than the configured interval
  const minInterval = spotifyConfig.vibeDescSyncMinIntervalMs;
  const lastSyncTime = playlist.vibeDescriptionSyncedAt?.getTime();
  if (lastSyncTime) {
    const elapsed = Date.now() - lastSyncTime;
    if (elapsed < minInterval) {
      logger.debug(
        { playlistId, elapsedMs: elapsed, minIntervalMs: minInterval },
        '[Swapify] Skipping vibe description sync — too soon since last update'
      );
      return;
    }
  }

  const description = buildSpotifyDescription(playlist.description, playlist.vibeName);

  try {
    await updatePlaylistDetails(playlist.ownerId, playlist.circleId, playlist.spotifyPlaylistId, {
      description,
    });

    await db
      .update(playlists)
      .set({ vibeDescriptionSyncedAt: new Date() })
      .where(eq(playlists.id, playlistId));

    logger.info(
      { playlistId, vibeName: playlist.vibeName },
      '[Swapify] Synced vibe to Spotify description'
    );
  } catch (error) {
    logger.error({ error, playlistId }, '[Swapify] Failed to sync vibe to Spotify description');
  }
}
