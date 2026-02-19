import type { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

/* eslint-disable @typescript-eslint/no-require-imports */

// Type from node-postgres driver — PGlite produces a compatible interface.
// `import type` is erased at compile time, so PGlite is NOT bundled.
type DrizzleDb = ReturnType<typeof drizzlePg<typeof schema>>;

const globalForDb = globalThis as unknown as {
  db: DrizzleDb | undefined;
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
    // Local dev: use PGlite (embedded Postgres, file-based)
    const { PGlite } = require('@electric-sql/pglite');
    const { drizzle } = require('drizzle-orm/pglite');
    const dataPath = process.env.DATABASE_PATH ?? './data/swapify-pg';
    const client = new PGlite(dataPath);
    return drizzle(client, { schema });
  }
}

globalForDb.db ??= createDb();

export const db = globalForDb.db;
