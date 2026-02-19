import { db } from '@/db';
import {
  playlists,
  playlistMembers,
  playlistTracks,
  trackListens,
  trackReactions,
  users,
} from '@/db/schema';
import { eq, and, isNull, isNotNull, inArray, ne, gt, lt } from 'drizzle-orm';
import {
  getRecentlyPlayed,
  getPlaylistItems,
  removeItemsFromPlaylist,
  addItemsToPlaylist,
  getCurrentPlayback,
  checkSavedTracks,
  isRateLimited,
  TokenInvalidError,
} from './spotify';
import { sendEmail } from './email';
import { generateId, getRemovalDelayMs, type RemovalDelay } from './utils';
import type { SpotifyRecentlyPlayedItem } from '@/types/spotify';
import { logger } from '@/lib/logger';
import { spotifyConfig, isOverBudget } from '@/lib/spotify-config';

const SKIP_THRESHOLD = 0.5; // < 50% listened = skip

interface PlaybackSnapshot {
  trackId: string;
  progressMs: number;
  durationMs: number;
  capturedAt: number;
}

interface PollCycleResult {
  usersPolled: number;
  listensRecorded: number;
  skipsDetected: number;
  tracksRemoved: number;
}

// ─── Main Poll Cycle ────────────────────────────────────────────────────────

export async function runPollCycle(): Promise<PollCycleResult> {
  const counters = { listensRecorded: 0, skipsDetected: 0, tracksRemoved: 0 };

  // 1. Get all playlists with active tracks
  const activeTrackPlaylistIds = await db
    .selectDistinct({ playlistId: playlistTracks.playlistId })
    .from(playlistTracks)
    .where(isNull(playlistTracks.removedAt));

  if (activeTrackPlaylistIds.length === 0) {
    return { usersPolled: 0, ...counters };
  }

  const playlistIds = activeTrackPlaylistIds.map((r) => r.playlistId);

  // 2. Get all unique users across those playlists
  const activeMembers = await db
    .selectDistinct({ userId: playlistMembers.userId })
    .from(playlistMembers)
    .where(inArray(playlistMembers.playlistId, playlistIds));

  // Spread API calls across ~50% of the poll interval to avoid bursts.
  // At least 300ms between users, at most 2s.
  const interUserDelayMs = Math.min(2000, Math.max(300, Math.floor(15000 / activeMembers.length)));

  // 3. Poll each user
  for (const { userId } of activeMembers) {
    if (isRateLimited() || isOverBudget()) {
      logger.warn('[Swapify] Rate-limited or over API budget, aborting poll cycle');
      break;
    }

    try {
      await pollUser(userId, counters);
    } catch (error) {
      if (error instanceof TokenInvalidError) {
        logger.warn(`[Swapify] Token invalid for user ${userId}, clearing refresh token`);
        const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
        // Clear refresh token so poller skips this user until they re-login
        await db.update(users).set({ refreshToken: '' }).where(eq(users.id, userId));
        // Account-critical email — always send regardless of notifyEmail preference
        if (user?.email) {
          await sendEmail(
            user.email,
            'Your Spotify connection needs attention',
            'Your Spotify session has expired and we can no longer track your listening. Please log in to Swapify again to reconnect your account.',
            process.env.NEXT_PUBLIC_BASE_URL || 'https://swapify.app',
            user.id
          );
        }
        continue;
      }
      logger.error({ error, userId }, 'Error polling user');
    }

    await new Promise((r) => setTimeout(r, interUserDelayMs));
  }

  // 4. Sweep for completed tracks that weren't removed on first detection
  const affectedPlaylistIds = new Set<string>();
  try {
    const { count, playlistIds } = await checkAndRemoveAllCompletedTracks();
    counters.tracksRemoved += count;
    playlistIds.forEach((id) => affectedPlaylistIds.add(id));
  } catch (error) {
    logger.error({ error }, '[Swapify] Completion sweep error');
  }

  // 5. Check for age-based track expiry
  try {
    const { count, playlistIds } = await checkAndRemoveExpiredTracks();
    counters.tracksRemoved += count;
    playlistIds.forEach((id) => affectedPlaylistIds.add(id));
  } catch (error) {
    logger.error({ error }, '[Swapify] Expired track check error');
  }

  // 6. Check for delayed removal tracks (completedAt + delay elapsed)
  try {
    const { count, playlistIds } = await checkAndRemoveDelayedTracks();
    counters.tracksRemoved += count;
    playlistIds.forEach((id) => affectedPlaylistIds.add(id));
  } catch (error) {
    logger.error({ error }, '[Swapify] Delayed track removal check error');
  }

  // Regenerate vibe names for playlists that had tracks removed
  for (const playlistId of affectedPlaylistIds) {
    import('@/lib/vibe-sort').then(({ vibeSort }) => {
      vibeSort(playlistId).catch(() => {});
    });
  }

  // 7. Check if members saved active tracks to their Spotify library → auto-like
  savedCheckCycleCount++;
  if (savedCheckCycleCount >= spotifyConfig.savedCheckEveryNCycles) {
    savedCheckCycleCount = 0;
    try {
      await checkSavedTracksForAutoLike();
    } catch (error) {
      logger.error({ error }, '[Swapify] Saved tracks auto-like check error');
    }
  }

  // 8. Playlist audit every N cycles (detect external adds, enforce limits)
  auditCycleCount++;
  if (auditCycleCount >= spotifyConfig.auditEveryNCycles) {
    auditCycleCount = 0;
    try {
      const auditResult = await runPlaylistAudit();
      if (auditResult.unauthorizedRemoved > 0 || auditResult.overLimitRemoved > 0) {
        logger.info(
          `[Swapify] Audit: ${auditResult.unauthorizedRemoved} unauthorized removed, ${auditResult.overLimitRemoved} over-limit removed`
        );
      }
    } catch (error) {
      logger.error({ error }, '[Swapify] Playlist audit error');
    }
  }

  // 8. Sync liked playlists every N cycles
  likedSyncCycleCount++;
  if (likedSyncCycleCount >= spotifyConfig.likedSyncEveryNCycles) {
    likedSyncCycleCount = 0;
    try {
      await syncAllLikedPlaylists();
    } catch (error) {
      logger.error({ error }, '[Swapify] Liked playlist sync error');
    }
  }

  return { usersPolled: activeMembers.length, ...counters };
}

// ─── Per-User Polling ───────────────────────────────────────────────────────

async function pollUser(
  userId: string,
  counters: { listensRecorded: number; skipsDetected: number; tracksRemoved: number }
): Promise<void> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  if (!user) return;

  // Skip users whose refresh token was cleared (needs re-login)
  if (!user.refreshToken) return;

  const recentTracks = await getRecentlyPlayed(userId, user.lastPollCursor ?? undefined);

  // Parse last playback snapshot
  let lastPlayback: PlaybackSnapshot | null = null;
  if (user.lastPlaybackJson) {
    try {
      lastPlayback = JSON.parse(user.lastPlaybackJson);
    } catch {
      // Invalid JSON, ignore
    }
  }

  // Only call getCurrentPlayback when needed:
  // - we have a previous snapshot to compare against, OR
  // - there are recent tracks (to capture a new snapshot for future comparison)
  let currentPlayback: Awaited<ReturnType<typeof getCurrentPlayback>> = null;
  if (lastPlayback || recentTracks.length > 0) {
    try {
      currentPlayback = await getCurrentPlayback(userId);
    } catch {
      // Non-critical, continue without skip detection
    }
  }

  const currentTrackId = currentPlayback?.item?.id ?? null;
  const isCurrentlyPlaying = currentPlayback?.is_playing ?? false;

  // Skip detection: user switched off a playlist track before finishing
  if (lastPlayback && isCurrentlyPlaying && currentTrackId !== lastPlayback.trackId) {
    counters.skipsDetected += await handleSkipDetection(
      userId,
      user.autoNegativeReactions,
      lastPlayback,
      recentTracks
    );
  }

  // Process recently played (full listens)
  const latestCursor = await processRecentlyPlayed(
    userId,
    recentTracks,
    user.lastPollCursor ?? 0,
    counters
  );

  // Update cursor
  if (latestCursor > (user.lastPollCursor ?? 0)) {
    await db.update(users).set({ lastPollCursor: latestCursor }).where(eq(users.id, userId));
  }

  // Save playback snapshot (only when actively playing — don't clear on pause)
  if (isCurrentlyPlaying && currentPlayback?.item) {
    const snapshot: PlaybackSnapshot = {
      trackId: currentPlayback.item.id,
      progressMs: currentPlayback.progress_ms ?? 0,
      durationMs: currentPlayback.item.duration_ms,
      capturedAt: Date.now(),
    };
    await db
      .update(users)
      .set({ lastPlaybackJson: JSON.stringify(snapshot) })
      .where(eq(users.id, userId));
  }
}

// ─── Skip Detection ─────────────────────────────────────────────────────────

async function handleSkipDetection(
  userId: string,
  autoNegativeReactions: boolean,
  lastPlayback: PlaybackSnapshot,
  recentTracks: SpotifyRecentlyPlayedItem[]
): Promise<number> {
  const wasInRecentlyPlayed = recentTracks.some((p) => p.track.id === lastPlayback.trackId);
  if (wasInRecentlyPlayed || lastPlayback.durationMs <= 0) return 0;

  const listenRatio = lastPlayback.progressMs / lastPlayback.durationMs;
  if (listenRatio >= SKIP_THRESHOLD) return 0;

  // Find matching active playlist tracks for the skipped track
  const skippedPlaylistTracks = await db.query.playlistTracks.findMany({
    where: and(
      eq(playlistTracks.spotifyTrackId, lastPlayback.trackId),
      isNull(playlistTracks.removedAt),
      ne(playlistTracks.addedByUserId, userId)
    ),
  });

  let skips = 0;

  for (const playlistTrack of skippedPlaylistTracks) {
    if (!(await isPlaylistMember(playlistTrack.playlistId, userId))) continue;

    // Record skip listen (only if no existing full listen)
    const existingListen = await findListen(playlistTrack.playlistId, lastPlayback.trackId, userId);

    if (!existingListen) {
      try {
        await db.insert(trackListens).values({
          id: generateId(),
          playlistId: playlistTrack.playlistId,
          spotifyTrackId: lastPlayback.trackId,
          userId,
          listenedAt: new Date(),
          listenDurationMs: lastPlayback.progressMs,
          wasSkipped: true,
        });
        skips++;
      } catch {
        // Ignore constraint violations
      }
    }

    // Auto thumbs_down for skip (if user has auto-negative enabled)
    if (autoNegativeReactions) {
      await setAutoReaction(playlistTrack.playlistId, lastPlayback.trackId, userId, 'thumbs_down');
    }
  }

  return skips;
}

// ─── Recently Played Processing ─────────────────────────────────────────────

async function processRecentlyPlayed(
  userId: string,
  recentTracks: SpotifyRecentlyPlayedItem[],
  currentCursor: number,
  counters: { listensRecorded: number; tracksRemoved: number }
): Promise<number> {
  let latestCursor = currentCursor;

  for (const play of recentTracks) {
    const playedAtMs = new Date(play.played_at).getTime();
    if (playedAtMs > latestCursor) {
      latestCursor = playedAtMs;
    }

    // Find matching active playlist tracks (not added by this user)
    const matchingTracks = await db.query.playlistTracks.findMany({
      where: and(
        eq(playlistTracks.spotifyTrackId, play.track.id),
        isNull(playlistTracks.removedAt),
        ne(playlistTracks.addedByUserId, userId)
      ),
    });

    for (const playlistTrack of matchingTracks) {
      if (!(await isPlaylistMember(playlistTrack.playlistId, userId))) continue;

      // Record or upgrade the listen
      const recorded = await recordFullListen(
        playlistTrack.playlistId,
        play.track.id,
        userId,
        new Date(play.played_at),
        play.track.duration_ms
      );
      if (recorded) counters.listensRecorded++;

      // Check if all members have listened → remove from playlist
      const removed = await checkAndRemoveIfComplete(playlistTrack);
      if (removed) counters.tracksRemoved++;
    }
  }

  return latestCursor;
}

// ─── Shared Helpers ─────────────────────────────────────────────────────────

async function isPlaylistMember(playlistId: string, userId: string): Promise<boolean> {
  const membership = await db.query.playlistMembers.findFirst({
    where: and(eq(playlistMembers.playlistId, playlistId), eq(playlistMembers.userId, userId)),
  });
  return !!membership;
}

async function findListen(playlistId: string, spotifyTrackId: string, userId: string) {
  return db.query.trackListens.findFirst({
    where: and(
      eq(trackListens.playlistId, playlistId),
      eq(trackListens.spotifyTrackId, spotifyTrackId),
      eq(trackListens.userId, userId)
    ),
  });
}

async function recordFullListen(
  playlistId: string,
  spotifyTrackId: string,
  userId: string,
  listenedAt: Date,
  durationMs: number
): Promise<boolean> {
  const existing = await findListen(playlistId, spotifyTrackId, userId);

  if (existing) {
    // Upgrade skip → full listen
    if (existing.wasSkipped) {
      await db
        .update(trackListens)
        .set({ wasSkipped: false, listenDurationMs: durationMs, listenedAt })
        .where(eq(trackListens.id, existing.id));
      return true;
    }
    return false;
  }

  try {
    await db.insert(trackListens).values({
      id: generateId(),
      playlistId,
      spotifyTrackId,
      userId,
      listenedAt,
      listenDurationMs: durationMs,
      wasSkipped: false,
    });
    return true;
  } catch {
    return false; // Unique constraint violation
  }
}

/**
 * Sets an auto-reaction for a user on a track.
 * - Won't overwrite manual reactions.
 * - thumbs_up upgrades a previous auto thumbs_down (skip → library save).
 * - thumbs_down won't overwrite an existing auto thumbs_up.
 */
export async function setAutoReaction(
  playlistId: string,
  spotifyTrackId: string,
  userId: string,
  reaction: 'thumbs_up' | 'thumbs_down'
): Promise<void> {
  try {
    const existing = await db.query.trackReactions.findFirst({
      where: and(
        eq(trackReactions.playlistId, playlistId),
        eq(trackReactions.spotifyTrackId, spotifyTrackId),
        eq(trackReactions.userId, userId)
      ),
    });

    if (!existing) {
      await db.insert(trackReactions).values({
        id: generateId(),
        playlistId,
        spotifyTrackId,
        userId,
        reaction,
        isAuto: true,
      });
    } else if (existing.isAuto && reaction === 'thumbs_up' && existing.reaction === 'thumbs_down') {
      // Upgrade auto thumbs_down (from skip) to thumbs_up (library save)
      await db
        .update(trackReactions)
        .set({ reaction: 'thumbs_up' })
        .where(eq(trackReactions.id, existing.id));
    }
    // Don't overwrite manual reactions or downgrade auto thumbs_up
  } catch {
    // Ignore constraint violations
  }
}

// ─── Completion & Archival ──────────────────────────────────────────────────

async function removeAndArchiveTrack(
  track: typeof playlistTracks.$inferSelect,
  playlist: typeof playlists.$inferSelect
): Promise<boolean> {
  try {
    await removeItemsFromPlaylist(playlist.ownerId, playlist.spotifyPlaylistId, [
      track.spotifyTrackUri,
    ]);
  } catch (error) {
    logger.error({ error }, 'Failed to remove track from Spotify playlist');
  }

  await db
    .update(playlistTracks)
    .set({ removedAt: new Date() })
    .where(eq(playlistTracks.id, track.id));

  return true;
}

async function checkAndRemoveIfComplete(
  track: typeof playlistTracks.$inferSelect
): Promise<boolean> {
  const members = await db.query.playlistMembers.findMany({
    where: and(
      eq(playlistMembers.playlistId, track.playlistId),
      ne(playlistMembers.userId, track.addedByUserId)
    ),
  });

  if (members.length === 0) return false;

  const listens = await db.query.trackListens.findMany({
    where: and(
      eq(trackListens.playlistId, track.playlistId),
      eq(trackListens.spotifyTrackId, track.spotifyTrackId)
    ),
  });

  // Reactions also count as engagement (user has heard the track)
  const reactions = await db.query.trackReactions.findMany({
    where: and(
      eq(trackReactions.playlistId, track.playlistId),
      eq(trackReactions.spotifyTrackId, track.spotifyTrackId)
    ),
  });

  // Count full listens + any reactions toward completion
  const fullListens = listens.filter((l) => !l.wasSkipped);
  const engagedUserIds = new Set([
    ...fullListens.map((l) => l.userId),
    ...reactions.map((r) => r.userId),
  ]);
  const allListened = members.every((m) => engagedUserIds.has(m.userId));

  if (!allListened) return false;

  const playlist = await db.query.playlists.findFirst({
    where: eq(playlists.id, track.playlistId),
  });
  if (!playlist) return false;

  const delay = playlist.removalDelay as RemovalDelay;

  if (delay === 'immediate') {
    return removeAndArchiveTrack(track, playlist);
  }

  // Non-immediate: set completedAt if not already set
  if (!track.completedAt) {
    await db
      .update(playlistTracks)
      .set({ completedAt: new Date() })
      .where(eq(playlistTracks.id, track.id));
  }

  return false;
}

// ─── Completion Sweep (catch tracks missed by event-driven check) ──────────

async function checkAndRemoveAllCompletedTracks(): Promise<{
  count: number;
  playlistIds: Set<string>;
}> {
  const activeTracks = await db.query.playlistTracks.findMany({
    where: and(isNull(playlistTracks.removedAt), isNull(playlistTracks.completedAt)),
  });

  let count = 0;
  const playlistIds = new Set<string>();

  for (const track of activeTracks) {
    const removed = await checkAndRemoveIfComplete(track);
    if (removed) {
      count++;
      playlistIds.add(track.playlistId);
    }
  }

  return { count, playlistIds };
}

// ─── Age-Based Track Expiry ────────────────────────────────────────────────

async function checkAndRemoveExpiredTracks(): Promise<{ count: number; playlistIds: Set<string> }> {
  const expiryPlaylists = await db.query.playlists.findMany({
    where: gt(playlists.maxTrackAgeDays, 0),
  });

  let count = 0;
  const playlistIds = new Set<string>();

  for (const playlist of expiryPlaylists) {
    const cutoff = new Date(Date.now() - playlist.maxTrackAgeDays * 24 * 60 * 60 * 1000);

    const oldTracks = await db.query.playlistTracks.findMany({
      where: and(
        eq(playlistTracks.playlistId, playlist.id),
        isNull(playlistTracks.removedAt),
        lt(playlistTracks.addedAt, cutoff)
      ),
    });

    for (const track of oldTracks) {
      // Remove tracks that have exceeded the age limit.
      // No listen requirement — the age limit is the fallback for
      // listeners who aren't on the web app (their listens aren't tracked).
      const removed = await removeAndArchiveTrack(track, playlist);
      if (removed) {
        count++;
        playlistIds.add(playlist.id);
      }
    }
  }

  return { count, playlistIds };
}

// ─── Delayed Track Removal ─────────────────────────────────────────────────

async function checkAndRemoveDelayedTracks(): Promise<{ count: number; playlistIds: Set<string> }> {
  const pendingTracks = await db.query.playlistTracks.findMany({
    where: and(isNull(playlistTracks.removedAt), isNotNull(playlistTracks.completedAt)),
  });

  let count = 0;
  const playlistIds = new Set<string>();

  for (const track of pendingTracks) {
    const playlist = await db.query.playlists.findFirst({
      where: eq(playlists.id, track.playlistId),
    });
    if (!playlist) continue;

    const delayMs = getRemovalDelayMs(playlist.removalDelay as RemovalDelay);
    const elapsed = Date.now() - track.completedAt!.getTime();

    if (elapsed >= delayMs) {
      const removed = await removeAndArchiveTrack(track, playlist);
      if (removed) {
        count++;
        playlistIds.add(track.playlistId);
      }
    }
  }

  return { count, playlistIds };
}

// ─── Library Save Detection (auto-like) ─────────────────────────────────

let savedCheckCycleCount = 0;

/**
 * For each active playlist track, check if non-adder members have saved
 * it to their Spotify library. If so, auto-like it.
 * Batches up to 50 track IDs per Spotify API call.
 */
async function checkSavedTracksForAutoLike(): Promise<void> {
  const activeTracks = await db.query.playlistTracks.findMany({
    where: isNull(playlistTracks.removedAt),
  });

  if (activeTracks.length === 0) return;

  // Group tracks by playlist
  const tracksByPlaylist = new Map<string, (typeof activeTracks)[number][]>();
  for (const track of activeTracks) {
    const list = tracksByPlaylist.get(track.playlistId) ?? [];
    list.push(track);
    tracksByPlaylist.set(track.playlistId, list);
  }

  // Get all existing thumbs_up reactions so we can skip tracks already liked
  const existingUpReactions = await db.query.trackReactions.findMany({
    where: eq(trackReactions.reaction, 'thumbs_up'),
  });
  const upReactionKeys = new Set(
    existingUpReactions.map((r) => `${r.playlistId}:${r.spotifyTrackId}:${r.userId}`)
  );

  for (const [playlistId, tracks] of tracksByPlaylist) {
    if (isRateLimited() || isOverBudget()) break;

    const members = await db.query.playlistMembers.findMany({
      where: eq(playlistMembers.playlistId, playlistId),
    });

    for (const member of members) {
      if (isRateLimited() || isOverBudget()) break;
      await checkMemberSavedTracks(playlistId, tracks, member.userId, upReactionKeys);
    }
  }
}

/** Check whether a single member has saved any of the given playlist tracks to their library. */
async function checkMemberSavedTracks(
  playlistId: string,
  tracks: (typeof playlistTracks.$inferSelect)[],
  userId: string,
  upReactionKeys: Set<string>
): Promise<void> {
  const uncheckedTracks = tracks.filter(
    (t) =>
      t.addedByUserId !== userId &&
      !upReactionKeys.has(`${playlistId}:${t.spotifyTrackId}:${userId}`)
  );

  if (uncheckedTracks.length === 0) return;

  // Batch check in groups of 50 (Spotify API limit)
  for (let i = 0; i < uncheckedTracks.length; i += 50) {
    if (isRateLimited()) break;

    const batch = uncheckedTracks.slice(i, i + 50);
    try {
      const savedFlags = await checkSavedTracks(
        userId,
        batch.map((t) => t.spotifyTrackId)
      );
      for (let j = 0; j < batch.length; j++) {
        const track = batch[j];
        if (savedFlags[j] && track) {
          await setAutoReaction(playlistId, track.spotifyTrackId, userId, 'thumbs_up');
        }
      }
    } catch (error) {
      if (error instanceof TokenInvalidError) return;
      // Rate limited or other transient error — skip batch
    }
  }
}

// ─── Playlist Audit (external add enforcement) ─────────────────────────

let auditCycleCount = 0;

let likedSyncCycleCount = 0;

export async function runPlaylistAudit(): Promise<{
  unauthorizedRemoved: number;
  overLimitRemoved: number;
}> {
  const counters = { unauthorizedRemoved: 0, overLimitRemoved: 0 };

  const activeTrackPlaylistIds = await db
    .selectDistinct({ playlistId: playlistTracks.playlistId })
    .from(playlistTracks)
    .where(isNull(playlistTracks.removedAt));

  for (const { playlistId } of activeTrackPlaylistIds) {
    if (isRateLimited() || isOverBudget()) break;

    try {
      await auditPlaylist(playlistId, counters);
    } catch (error) {
      logger.error({ error, playlistId }, '[Swapify] Audit error for playlist');
    }
  }

  return counters;
}

async function auditPlaylist(
  playlistId: string,
  counters: { unauthorizedRemoved: number; overLimitRemoved: number }
): Promise<void> {
  const playlist = await db.query.playlists.findFirst({
    where: eq(playlists.id, playlistId),
  });
  if (!playlist) return;

  const spotifyItems = await getPlaylistItems(playlist.ownerId, playlist.spotifyPlaylistId);

  const localTracks = await db.query.playlistTracks.findMany({
    where: and(eq(playlistTracks.playlistId, playlistId), isNull(playlistTracks.removedAt)),
  });
  const localTrackUris = new Set(localTracks.map((t) => t.spotifyTrackUri));

  const externalItems = spotifyItems.filter((item) => !localTrackUris.has(item.track.uri));

  if (externalItems.length === 0) return;

  const urisToRemove: string[] = [];
  let adopted = 0;

  for (const spotifyItem of externalItems) {
    const spotifyUserId = spotifyItem.added_by.id;

    const appUser = await db.query.users.findFirst({
      where: eq(users.spotifyId, spotifyUserId),
    });

    if (!appUser) {
      // Non-registered user — remove silently
      urisToRemove.push(spotifyItem.track.uri);
      counters.unauthorizedRemoved++;
      continue;
    }

    const memberOfPlaylist = await isPlaylistMember(playlistId, appUser.id);
    if (!memberOfPlaylist) {
      // Not a member of this playlist — remove silently
      urisToRemove.push(spotifyItem.track.uri);
      counters.unauthorizedRemoved++;
      continue;
    }

    // Check per-user track limit
    if (playlist.maxTracksPerUser !== null) {
      const activeCount = localTracks.filter((t) => t.addedByUserId === appUser.id).length;

      if (activeCount >= playlist.maxTracksPerUser) {
        urisToRemove.push(spotifyItem.track.uri);
        counters.overLimitRemoved++;

        // Notify via both push + email, respecting granular prefs
        import('@/lib/notifications').then(({ notify }) => {
          notify(
            appUser.id,
            {
              title: 'Track removed',
              body: `Your track "${spotifyItem.track.name}" by ${spotifyItem.track.artists.map((a) => a.name).join(', ')} was removed from "${playlist.name}" because you've reached the limit of ${playlist.maxTracksPerUser} active track${playlist.maxTracksPerUser === 1 ? '' : 's'} per member.`,
              url: `${process.env.NEXT_PUBLIC_APP_URL}/playlist/${playlistId}`,
            },
            'trackRemoved'
          );
        });
        continue;
      }
    }

    // Valid member, under limit — adopt the external add into our DB
    try {
      await db.insert(playlistTracks).values({
        id: generateId(),
        playlistId,
        spotifyTrackUri: spotifyItem.track.uri,
        spotifyTrackId: spotifyItem.track.id,
        trackName: spotifyItem.track.name,
        artistName: spotifyItem.track.artists.map((a) => a.name).join(', '),
        albumName: spotifyItem.track.album?.name || null,
        albumImageUrl: spotifyItem.track.album?.images?.[0]?.url || null,
        durationMs: spotifyItem.track.duration_ms || null,
        addedByUserId: appUser.id,
      });
      adopted++;
    } catch {
      // Unique constraint violation — already tracked
    }
  }

  if (urisToRemove.length > 0) {
    try {
      await removeItemsFromPlaylist(playlist.ownerId, playlist.spotifyPlaylistId, urisToRemove);
    } catch (error) {
      logger.error({ error }, '[Swapify] Failed to remove unauthorized/over-limit tracks');
    }
  }

  // Auto-sort playlist by vibe when new tracks were adopted (fire-and-forget)
  if (adopted > 0) {
    import('./vibe-sort').then(({ vibeSort }) => {
      vibeSort(playlistId).catch(() => {});
    });
  }
}

// ─── Liked Playlist Sync ─────────────────────────────────────────────────

export async function syncLikedPlaylist(
  userId: string,
  playlistId: string,
  likedPlaylistId: string
): Promise<boolean> {
  // Get user's liked reactions
  const likedReactions = await db.query.trackReactions.findMany({
    where: and(
      eq(trackReactions.playlistId, playlistId),
      eq(trackReactions.userId, userId),
      eq(trackReactions.reaction, 'thumbs_up')
    ),
  });

  const likedTrackIds = new Set(likedReactions.map((r) => r.spotifyTrackId));

  // Get track URIs for liked tracks
  const allTracks = await db.query.playlistTracks.findMany({
    where: eq(playlistTracks.playlistId, playlistId),
  });
  const desiredUris = new Set<string>();
  for (const t of allTracks) {
    if (likedTrackIds.has(t.spotifyTrackId)) {
      desiredUris.add(t.spotifyTrackUri);
    }
  }

  // Get current Spotify playlist contents
  let spotifyItems: Awaited<ReturnType<typeof getPlaylistItems>>;
  try {
    spotifyItems = await getPlaylistItems(userId, likedPlaylistId);
  } catch (error) {
    if (String(error).includes('404') || String(error).includes('Not Found')) {
      // Playlist was deleted — clear likedPlaylistId
      const membership = await db.query.playlistMembers.findFirst({
        where: and(eq(playlistMembers.playlistId, playlistId), eq(playlistMembers.userId, userId)),
      });
      if (membership) {
        await db
          .update(playlistMembers)
          .set({ likedPlaylistId: null })
          .where(eq(playlistMembers.id, membership.id));
      }
      return false;
    }
    throw error;
  }

  const spotifyUris = new Set(spotifyItems.map((item) => item.track.uri));

  // Diff
  const toAdd = [...desiredUris].filter((uri) => !spotifyUris.has(uri));
  const toRemove = [...spotifyUris].filter((uri) => !desiredUris.has(uri));

  if (toAdd.length > 0) {
    for (let i = 0; i < toAdd.length; i += 100) {
      await addItemsToPlaylist(userId, likedPlaylistId, toAdd.slice(i, i + 100));
    }
  }
  if (toRemove.length > 0) {
    for (let i = 0; i < toRemove.length; i += 100) {
      await removeItemsFromPlaylist(userId, likedPlaylistId, toRemove.slice(i, i + 100));
    }
  }

  return true;
}

async function syncAllLikedPlaylists(): Promise<void> {
  const membersWithLiked = await db.query.playlistMembers.findMany({
    where: isNotNull(playlistMembers.likedPlaylistId),
  });

  for (const member of membersWithLiked) {
    if (isRateLimited() || isOverBudget()) break;
    try {
      await syncLikedPlaylist(member.userId, member.playlistId, member.likedPlaylistId!);
    } catch (error) {
      if (error instanceof TokenInvalidError) {
        logger.warn(`[Swapify] Token invalid for user ${member.userId} during liked sync`);
        continue;
      }
      logger.error({ error, userId: member.userId }, '[Swapify] Liked sync error for member');
    }
  }
}

// ─── Polling Loop ───────────────────────────────────────────────────────────

let pollInterval: ReturnType<typeof setInterval> | null = null;
let pollRunning = false;

export function startPollingLoop(intervalMs: number = spotifyConfig.pollIntervalMs) {
  if (pollInterval) return;

  logger.info(`[Swapify] Starting poll loop every ${intervalMs}ms`);

  pollInterval = setInterval(async () => {
    if (pollRunning) {
      logger.warn('[Swapify] Previous poll cycle still running, skipping');
      return;
    }
    pollRunning = true;
    try {
      const result = await runPollCycle();
      if (result.listensRecorded > 0 || result.skipsDetected > 0 || result.tracksRemoved > 0) {
        logger.info(
          `[Swapify] Poll: ${result.usersPolled} users, ${result.listensRecorded} listens, ${result.skipsDetected} skips, ${result.tracksRemoved} removed`
        );
      }
    } catch (error) {
      logger.error({ error }, '[Swapify] Poll cycle error');
    } finally {
      pollRunning = false;
    }
  }, intervalMs);
}

export function stopPollingLoop() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
    logger.info('[Swapify] Polling stopped');
  }
}
