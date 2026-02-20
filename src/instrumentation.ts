export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // PGlite: prepare data dir (wipe if corrupted) and run migrations.
    // Uses a SEPARATE temporary PGlite instance so the db singleton in
    // index.ts gets a fresh connection with a clean catalog cache.
    // Running DDL + DML through the same PGlite instance causes
    // "cache lookup failed for constraint" errors.
    if (!process.env.DATABASE_URL) {
      const { PGlite } = await import('@electric-sql/pglite');
      const { drizzle } = await import('drizzle-orm/pglite');
      const { migrate } = await import('drizzle-orm/pglite/migrator');
      const { preparePgliteDataDir, cleanPgliteLock, markCleanShutdown } =
        await import('./db/pglite-lock');

      const dataPath = process.env.DATABASE_PATH ?? './data/swapify-pg';
      preparePgliteDataDir(dataPath);
      cleanPgliteLock(dataPath);

      const client = new PGlite(dataPath);
      const tempDb = drizzle(client);
      await migrate(tempDb, { migrationsFolder: './drizzle' });
      await client.close();
      markCleanShutdown(dataPath);
    }

    const { startPollingLoop } = await import('./lib/polling');
    const interval = Number(process.env.POLL_INTERVAL_MS) || 30000;
    startPollingLoop(interval);
  }
}
