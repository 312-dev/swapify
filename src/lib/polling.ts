import { db } from "@/db";
import {
  jams,
  jamMembers,
  jamTracks,
  trackListens,
  trackReactions,
  users,
} from "@/db/schema";
import { eq, and, isNull, inArray, ne, gt, lt } from "drizzle-orm";
import {
  getRecentlyPlayed,
  getPlaylistItems,
  removeItemsFromPlaylist,
  addItemsToPlaylist,
  getCurrentPlayback,
  isRateLimited,
} from "./spotify";
import { sendEmail } from "./email";
import { generateId } from "./utils";
import type { SpotifyRecentlyPlayedItem } from "@/types/spotify";

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

  // 1. Get all jams with active tracks
  const activeTrackJamIds = await db
    .selectDistinct({ jamId: jamTracks.jamId })
    .from(jamTracks)
    .where(isNull(jamTracks.removedAt));

  if (activeTrackJamIds.length === 0) {
    return { usersPolled: 0, ...counters };
  }

  const jamIds = activeTrackJamIds.map((r) => r.jamId);

  // 2. Get all unique users across those jams
  const activeMembers = await db
    .selectDistinct({ userId: jamMembers.userId })
    .from(jamMembers)
    .where(inArray(jamMembers.jamId, jamIds));

  // Spread API calls across ~50% of the poll interval to avoid bursts.
  // At least 300ms between users, at most 2s.
  const interUserDelayMs = Math.min(
    2000,
    Math.max(300, Math.floor(15000 / activeMembers.length))
  );

  // 3. Poll each user
  for (const { userId } of activeMembers) {
    if (isRateLimited()) {
      console.warn("[Deep Digs] Rate-limited by Spotify, aborting poll cycle");
      break;
    }

    try {
      await pollUser(userId, counters);
    } catch (error) {
      console.error(`Error polling user ${userId}:`, error);
    }

    await new Promise((r) => setTimeout(r, interUserDelayMs));
  }

  // 4. Check for age-based track expiry
  try {
    const expiredRemoved = await checkAndRemoveExpiredTracks();
    counters.tracksRemoved += expiredRemoved;
  } catch (error) {
    console.error("[Deep Digs] Expired track check error:", error);
  }

  // 5. Playlist audit every N cycles (detect external adds, enforce limits)
  auditCycleCount++;
  if (auditCycleCount >= AUDIT_EVERY_N_CYCLES) {
    auditCycleCount = 0;
    try {
      const auditResult = await runPlaylistAudit();
      if (auditResult.unauthorizedRemoved > 0 || auditResult.overLimitRemoved > 0) {
        console.log(
          `[Deep Digs] Audit: ${auditResult.unauthorizedRemoved} unauthorized removed, ${auditResult.overLimitRemoved} over-limit removed`
        );
      }
    } catch (error) {
      console.error("[Deep Digs] Playlist audit error:", error);
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

  const recentTracks = await getRecentlyPlayed(
    userId,
    user.lastPollCursor ?? undefined
  );

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

  // Skip detection: user switched off a jam track before finishing
  if (
    lastPlayback &&
    isCurrentlyPlaying &&
    currentTrackId !== lastPlayback.trackId
  ) {
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
    await db
      .update(users)
      .set({ lastPollCursor: latestCursor })
      .where(eq(users.id, userId));
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
  autoNegativeReactions: number,
  lastPlayback: PlaybackSnapshot,
  recentTracks: SpotifyRecentlyPlayedItem[]
): Promise<number> {
  const wasInRecentlyPlayed = recentTracks.some(
    (p) => p.track.id === lastPlayback.trackId
  );
  if (wasInRecentlyPlayed || lastPlayback.durationMs <= 0) return 0;

  const listenRatio = lastPlayback.progressMs / lastPlayback.durationMs;
  if (listenRatio >= SKIP_THRESHOLD) return 0;

  // Find matching active jam tracks for the skipped track
  const skippedJamTracks = await db.query.jamTracks.findMany({
    where: and(
      eq(jamTracks.spotifyTrackId, lastPlayback.trackId),
      isNull(jamTracks.removedAt),
      ne(jamTracks.addedByUserId, userId)
    ),
  });

  let skips = 0;

  for (const jamTrack of skippedJamTracks) {
    if (!(await isJamMember(jamTrack.jamId, userId))) continue;

    // Record skip listen (only if no existing full listen)
    const existingListen = await findListen(
      jamTrack.jamId,
      lastPlayback.trackId,
      userId
    );

    if (!existingListen) {
      try {
        await db.insert(trackListens).values({
          id: generateId(),
          jamId: jamTrack.jamId,
          spotifyTrackId: lastPlayback.trackId,
          userId,
          listenedAt: new Date(),
          listenDurationMs: lastPlayback.progressMs,
          wasSkipped: 1,
        });
        skips++;
      } catch {
        // Ignore constraint violations
      }
    }

    // Auto thumbs_down for skip (if user has auto-negative enabled)
    if (autoNegativeReactions) {
      await setAutoReaction(
        jamTrack.jamId,
        lastPlayback.trackId,
        userId,
        "thumbs_down"
      );
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

    // Find matching active jam tracks (not added by this user)
    const matchingTracks = await db.query.jamTracks.findMany({
      where: and(
        eq(jamTracks.spotifyTrackId, play.track.id),
        isNull(jamTracks.removedAt),
        ne(jamTracks.addedByUserId, userId)
      ),
    });

    for (const jamTrack of matchingTracks) {
      if (!(await isJamMember(jamTrack.jamId, userId))) continue;

      // Record or upgrade the listen
      const recorded = await recordFullListen(
        jamTrack.jamId,
        play.track.id,
        userId,
        new Date(play.played_at),
        play.track.duration_ms
      );
      if (recorded) counters.listensRecorded++;

      // Auto thumbs_up for full listen (upgrades previous auto-skip reactions)
      await setAutoReaction(
        jamTrack.jamId,
        play.track.id,
        userId,
        "thumbs_up"
      );

      // Check if all members have listened → remove from playlist
      const removed = await checkAndRemoveIfComplete(jamTrack);
      if (removed) counters.tracksRemoved++;
    }
  }

  return latestCursor;
}

// ─── Shared Helpers ─────────────────────────────────────────────────────────

async function isJamMember(
  jamId: string,
  userId: string
): Promise<boolean> {
  const membership = await db.query.jamMembers.findFirst({
    where: and(
      eq(jamMembers.jamId, jamId),
      eq(jamMembers.userId, userId)
    ),
  });
  return !!membership;
}

async function findListen(
  jamId: string,
  spotifyTrackId: string,
  userId: string
) {
  return db.query.trackListens.findFirst({
    where: and(
      eq(trackListens.jamId, jamId),
      eq(trackListens.spotifyTrackId, spotifyTrackId),
      eq(trackListens.userId, userId)
    ),
  });
}

async function recordFullListen(
  jamId: string,
  spotifyTrackId: string,
  userId: string,
  listenedAt: Date,
  durationMs: number
): Promise<boolean> {
  const existing = await findListen(jamId, spotifyTrackId, userId);

  if (existing) {
    // Upgrade skip → full listen
    if (existing.wasSkipped) {
      await db
        .update(trackListens)
        .set({ wasSkipped: 0, listenDurationMs: durationMs, listenedAt })
        .where(eq(trackListens.id, existing.id));
      return true;
    }
    return false;
  }

  try {
    await db.insert(trackListens).values({
      id: generateId(),
      jamId,
      spotifyTrackId,
      userId,
      listenedAt,
      listenDurationMs: durationMs,
      wasSkipped: 0,
    });
    return true;
  } catch {
    return false; // Unique constraint violation
  }
}

/**
 * Sets an auto-reaction for a user on a track.
 * - Won't overwrite manual reactions.
 * - thumbs_up upgrades a previous auto thumbs_down (skip → full listen).
 * - thumbs_down won't overwrite an existing auto thumbs_up.
 */
async function setAutoReaction(
  jamId: string,
  spotifyTrackId: string,
  userId: string,
  reaction: "thumbs_up" | "thumbs_down"
): Promise<void> {
  try {
    const existing = await db.query.trackReactions.findFirst({
      where: and(
        eq(trackReactions.jamId, jamId),
        eq(trackReactions.spotifyTrackId, spotifyTrackId),
        eq(trackReactions.userId, userId)
      ),
    });

    if (!existing) {
      await db.insert(trackReactions).values({
        id: generateId(),
        jamId,
        spotifyTrackId,
        userId,
        reaction,
        isAuto: 1,
      });
    } else if (
      existing.isAuto &&
      reaction === "thumbs_up" &&
      existing.reaction === "thumbs_down"
    ) {
      // Upgrade auto thumbs_down (from skip) to thumbs_up (full listen)
      await db
        .update(trackReactions)
        .set({ reaction: "thumbs_up" })
        .where(eq(trackReactions.id, existing.id));
    }
    // Don't overwrite manual reactions or downgrade auto thumbs_up
  } catch {
    // Ignore constraint violations
  }
}

// ─── Completion & Archival ──────────────────────────────────────────────────

async function removeAndArchiveTrack(
  jamTrack: typeof jamTracks.$inferSelect,
  jam: typeof jams.$inferSelect
): Promise<boolean> {
  try {
    await removeItemsFromPlaylist(jam.ownerId, jam.spotifyPlaylistId, [
      jamTrack.spotifyTrackUri,
    ]);
  } catch (error) {
    console.error("Failed to remove track from Spotify playlist:", error);
  }

  await db
    .update(jamTracks)
    .set({ removedAt: new Date() })
    .where(eq(jamTracks.id, jamTrack.id));

  // Archive to Keepers playlist if threshold is met
  if (jam.archiveThreshold !== "none" && jam.archivePlaylistId) {
    try {
      const shouldArchive = await evaluateArchiveThreshold(jam, jamTrack);
      if (shouldArchive) {
        await addItemsToPlaylist(jam.ownerId, jam.archivePlaylistId, [
          jamTrack.spotifyTrackUri,
        ]);
        await db
          .update(jamTracks)
          .set({ archivedAt: new Date() })
          .where(eq(jamTracks.id, jamTrack.id));
      }
    } catch (error) {
      console.error("Failed to archive track to Keepers:", error);
    }
  }

  return true;
}

async function checkAndRemoveIfComplete(
  jamTrack: typeof jamTracks.$inferSelect
): Promise<boolean> {
  const members = await db.query.jamMembers.findMany({
    where: and(
      eq(jamMembers.jamId, jamTrack.jamId),
      ne(jamMembers.userId, jamTrack.addedByUserId)
    ),
  });

  if (members.length === 0) return false;

  const listens = await db.query.trackListens.findMany({
    where: and(
      eq(trackListens.jamId, jamTrack.jamId),
      eq(trackListens.spotifyTrackId, jamTrack.spotifyTrackId)
    ),
  });

  // Only count full listens (not skips) toward completion
  const fullListens = listens.filter((l) => !l.wasSkipped);
  const listenedUserIds = new Set(fullListens.map((l) => l.userId));
  const allListened = members.every((m) => listenedUserIds.has(m.userId));

  if (!allListened) return false;

  const jam = await db.query.jams.findFirst({
    where: eq(jams.id, jamTrack.jamId),
  });
  if (!jam) return false;

  return removeAndArchiveTrack(jamTrack, jam);
}

// ─── Age-Based Track Expiry ────────────────────────────────────────────────

async function checkAndRemoveExpiredTracks(): Promise<number> {
  const expiryJams = await db.query.jams.findMany({
    where: gt(jams.maxTrackAgeDays, 0),
  });

  let removedCount = 0;

  for (const jam of expiryJams) {
    const cutoff = new Date(Date.now() - jam.maxTrackAgeDays * 24 * 60 * 60 * 1000);

    const oldTracks = await db.query.jamTracks.findMany({
      where: and(
        eq(jamTracks.jamId, jam.id),
        isNull(jamTracks.removedAt),
        lt(jamTracks.addedAt, cutoff)
      ),
    });

    for (const track of oldTracks) {
      // Only expire if at least 1 non-adder member has listened (any listen, including skips)
      const nonAdderListen = await db.query.trackListens.findFirst({
        where: and(
          eq(trackListens.jamId, jam.id),
          eq(trackListens.spotifyTrackId, track.spotifyTrackId),
          ne(trackListens.userId, track.addedByUserId)
        ),
      });

      if (!nonAdderListen) continue;

      const removed = await removeAndArchiveTrack(track, jam);
      if (removed) removedCount++;
    }
  }

  return removedCount;
}

async function evaluateArchiveThreshold(
  jam: typeof jams.$inferSelect,
  jamTrack: typeof jamTracks.$inferSelect
): Promise<boolean> {
  const reactions = await db.query.trackReactions.findMany({
    where: and(
      eq(trackReactions.jamId, jamTrack.jamId),
      eq(trackReactions.spotifyTrackId, jamTrack.spotifyTrackId)
    ),
  });

  const members = await db.query.jamMembers.findMany({
    where: and(
      eq(jamMembers.jamId, jamTrack.jamId),
      ne(jamMembers.userId, jamTrack.addedByUserId)
    ),
  });

  const thumbsUp = reactions.filter((r) => r.reaction === "thumbs_up");
  const thumbsDown = reactions.filter((r) => r.reaction === "thumbs_down");

  switch (jam.archiveThreshold) {
    case "no_dislikes":
      return thumbsDown.length === 0;
    case "at_least_one_like":
      return thumbsUp.length >= 1;
    case "universally_liked":
      return members.every((m) =>
        thumbsUp.some((r) => r.userId === m.userId)
      );
    default:
      return false;
  }
}

// ─── Playlist Audit (external add enforcement) ─────────────────────────

let auditCycleCount = 0;
const AUDIT_EVERY_N_CYCLES = 2;

export async function runPlaylistAudit(): Promise<{
  unauthorizedRemoved: number;
  overLimitRemoved: number;
}> {
  const counters = { unauthorizedRemoved: 0, overLimitRemoved: 0 };

  const activeTrackJamIds = await db
    .selectDistinct({ jamId: jamTracks.jamId })
    .from(jamTracks)
    .where(isNull(jamTracks.removedAt));

  for (const { jamId } of activeTrackJamIds) {
    if (isRateLimited()) break;

    try {
      await auditJamPlaylist(jamId, counters);
    } catch (error) {
      console.error(`[Deep Digs] Audit error for jam ${jamId}:`, error);
    }
  }

  return counters;
}

async function auditJamPlaylist(
  jamId: string,
  counters: { unauthorizedRemoved: number; overLimitRemoved: number }
): Promise<void> {
  const jam = await db.query.jams.findFirst({
    where: eq(jams.id, jamId),
  });
  if (!jam) return;

  const spotifyItems = await getPlaylistItems(jam.ownerId, jam.spotifyPlaylistId);

  const localTracks = await db.query.jamTracks.findMany({
    where: and(eq(jamTracks.jamId, jamId), isNull(jamTracks.removedAt)),
  });
  const localTrackUris = new Set(localTracks.map((t) => t.spotifyTrackUri));

  const externalItems = spotifyItems.filter(
    (item) => !localTrackUris.has(item.item.uri)
  );

  if (externalItems.length === 0) return;

  const urisToRemove: string[] = [];

  for (const spotifyItem of externalItems) {
    const spotifyUserId = spotifyItem.added_by.id;

    const appUser = await db.query.users.findFirst({
      where: eq(users.spotifyId, spotifyUserId),
    });

    if (!appUser) {
      // Non-registered user — remove silently
      urisToRemove.push(spotifyItem.item.uri);
      counters.unauthorizedRemoved++;
      continue;
    }

    const memberOfJam = await isJamMember(jamId, appUser.id);
    if (!memberOfJam) {
      // Not a member of this jam — remove silently
      urisToRemove.push(spotifyItem.item.uri);
      counters.unauthorizedRemoved++;
      continue;
    }

    // Check per-user track limit
    if (jam.maxTracksPerUser !== null) {
      const activeCount = localTracks.filter(
        (t) => t.addedByUserId === appUser.id
      ).length;

      if (activeCount >= jam.maxTracksPerUser) {
        urisToRemove.push(spotifyItem.item.uri);
        counters.overLimitRemoved++;

        if (appUser.email) {
          await sendEmail(
            appUser.email,
            "Track removed",
            `Your track "${spotifyItem.item.name}" by ${spotifyItem.item.artists.map((a) => a.name).join(", ")} was removed from "${jam.name}" because you've reached the limit of ${jam.maxTracksPerUser} active track${jam.maxTracksPerUser === 1 ? "" : "s"} per member.`,
            `${process.env.NEXT_PUBLIC_APP_URL}/jam/${jamId}`
          );
        }
        continue;
      }
    }

    // Valid member, under limit — adopt the external add into our DB
    try {
      await db.insert(jamTracks).values({
        id: generateId(),
        jamId,
        spotifyTrackUri: spotifyItem.item.uri,
        spotifyTrackId: spotifyItem.item.id,
        trackName: spotifyItem.item.name,
        artistName: spotifyItem.item.artists.map((a) => a.name).join(", "),
        albumName: spotifyItem.item.album?.name || null,
        albumImageUrl: spotifyItem.item.album?.images?.[0]?.url || null,
        durationMs: spotifyItem.item.duration_ms || null,
        addedByUserId: appUser.id,
      });
    } catch {
      // Unique constraint violation — already tracked
    }
  }

  if (urisToRemove.length > 0) {
    try {
      await removeItemsFromPlaylist(
        jam.ownerId,
        jam.spotifyPlaylistId,
        urisToRemove
      );
    } catch (error) {
      console.error(
        `[Deep Digs] Failed to remove unauthorized/over-limit tracks:`,
        error
      );
    }
  }
}

// ─── Polling Loop ───────────────────────────────────────────────────────────

let pollInterval: ReturnType<typeof setInterval> | null = null;

export function startPollingLoop(intervalMs: number = 30000) {
  if (pollInterval) return;

  console.log(`[Deep Digs] Starting poll loop every ${intervalMs}ms`);

  pollInterval = setInterval(async () => {
    try {
      const result = await runPollCycle();
      if (result.listensRecorded > 0 || result.skipsDetected > 0 || result.tracksRemoved > 0) {
        console.log(
          `[Deep Digs] Poll: ${result.usersPolled} users, ${result.listensRecorded} listens, ${result.skipsDetected} skips, ${result.tracksRemoved} removed`
        );
      }
    } catch (error) {
      console.error("[Deep Digs] Poll cycle error:", error);
    }
  }, intervalMs);
}

export function stopPollingLoop() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
    console.log("[Deep Digs] Polling stopped");
  }
}
