import { existsSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CLEAN_MARKER = '.pglite_clean';

/**
 * Remove stale PGlite postmaster.pid lock files.
 */
export function cleanPgliteLock(dataPath: string): void {
  const pidFile = join(dataPath, 'postmaster.pid');
  if (existsSync(pidFile)) {
    unlinkSync(pidFile);
  }
}

/**
 * Wipe a corrupted PGlite data directory so it can be recreated from scratch.
 *
 * Since local dev data is ephemeral and always recreatable via migrations,
 * this is safe.
 */
export function wipePgliteData(dataPath: string): void {
  if (existsSync(dataPath)) {
    rmSync(dataPath, { recursive: true, force: true });
    console.log(`Wiped corrupted PGlite data: ${dataPath}`);
  }
}

/**
 * Write a marker file indicating the PGlite data directory was shut down
 * cleanly. Used on next startup to detect dirty shutdowns.
 */
export function markCleanShutdown(dataPath: string): void {
  try {
    writeFileSync(join(dataPath, CLEAN_MARKER), '');
  } catch {
    // Best-effort — data dir may not exist yet
  }
}

/**
 * Prepare the PGlite data directory for opening.
 *
 * PGlite (embedded Postgres in WASM) can't recover from dirty shutdowns.
 * Its constructor succeeds even with corrupted data, but queries then crash
 * with WASM Aborted() errors. Since we can't detect corruption synchronously
 * after construction, we use a clean-shutdown marker file:
 *
 * - If the data dir exists WITH a clean marker → safe to open (just remove lock)
 * - If the data dir exists WITHOUT a clean marker → dirty shutdown → wipe it
 * - If no data dir exists → fresh start (nothing to do)
 *
 * After opening PGlite, callers should register shutdown handlers that call
 * `markCleanShutdown()` to prevent unnecessary data loss on next startup.
 */
export function preparePgliteDataDir(dataPath: string): void {
  if (!existsSync(dataPath)) return;

  const markerPath = join(dataPath, CLEAN_MARKER);
  if (existsSync(markerPath)) {
    // Clean shutdown — just remove stale lock and marker
    cleanPgliteLock(dataPath);
    unlinkSync(markerPath);
  } else {
    // Dirty shutdown — data is likely corrupted, wipe it
    wipePgliteData(dataPath);
  }
}
