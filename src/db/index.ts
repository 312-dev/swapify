import type { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

/* eslint-disable @typescript-eslint/no-require-imports */

// Type from node-postgres driver — PGlite produces a compatible interface.
// `import type` is erased at compile time, so PGlite is NOT bundled.
type DrizzleDb = ReturnType<typeof drizzlePg<typeof schema>>;

const globalForDb = globalThis as unknown as {
  _db: DrizzleDb | undefined;
  pgliteShutdownRegistered: boolean | undefined;
};

function createDb(): DrizzleDb {
  if (process.env.DATABASE_URL) {
    // Production: connect to real PostgreSQL
    const { drizzle } = require('drizzle-orm/node-postgres');
    const pg = require('pg');
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
    });
    return drizzle(pool, { schema });
  } else {
    // Local dev: use PGlite (embedded Postgres, file-based).
    // Data dir preparation and migrations are handled by instrumentation.ts
    // BEFORE this runs. This is important: running DDL (migrations) and DML
    // (queries) through the same PGlite instance corrupts its catalog cache.
    const { PGlite } = require('@electric-sql/pglite');
    const { drizzle } = require('drizzle-orm/pglite');
    const { markCleanShutdown, cleanPgliteLock } = require('./pglite-lock');
    const dataPath = process.env.DATABASE_PATH ?? './data/swapify-pg';

    cleanPgliteLock(dataPath);
    const client = new PGlite(dataPath);

    // Register graceful shutdown handlers to prevent data corruption.
    // PGlite in WASM can't recover from dirty shutdowns, so we must
    // close it properly and write a clean-shutdown marker.
    if (!globalForDb.pgliteShutdownRegistered) {
      globalForDb.pgliteShutdownRegistered = true;
      const shutdown = (signal: string) => {
        client
          .close()
          .then(() => markCleanShutdown(dataPath))
          .catch(() => {})
          .finally(() => process.exit(signal === 'SIGTERM' ? 0 : 130));
      };
      process.once('SIGTERM', () => shutdown('SIGTERM'));
      process.once('SIGINT', () => shutdown('SIGINT'));
    }

    return drizzle(client, { schema });
  }
}

// Lazy initialization via Proxy. The actual PGlite connection is deferred
// until the first property access (i.e. the first DB query). This ensures
// instrumentation.ts has time to prepare the data dir and run migrations
// with a separate PGlite instance before this connection opens.
export const db: DrizzleDb = new Proxy({} as DrizzleDb, {
  get(_, prop) {
    globalForDb._db ??= createDb();
    return (globalForDb._db as unknown as Record<string | symbol, unknown>)[prop];
  },
});
