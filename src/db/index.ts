import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';

const schemaKey = Object.keys(schema).sort().join(',');

const globalForDb = globalThis as unknown as {
  db: ReturnType<typeof drizzle<typeof schema>> | undefined;
  sqlite: Database.Database | undefined;
  schemaKey: string | undefined;
};

if (!globalForDb.sqlite) {
  globalForDb.sqlite = new Database(process.env.DATABASE_PATH ?? './data/swapify.db');
  globalForDb.sqlite.pragma('journal_mode = WAL');
  globalForDb.sqlite.pragma('foreign_keys = ON');
}

if (!globalForDb.db || globalForDb.schemaKey !== schemaKey) {
  globalForDb.db = drizzle(globalForDb.sqlite, { schema });
  globalForDb.schemaKey = schemaKey;
}

export const db = globalForDb.db;
