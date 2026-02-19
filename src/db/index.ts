import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  db: ReturnType<typeof drizzle<typeof schema>> | undefined;
  sqlite: Database.Database | undefined;
};

if (!globalForDb.sqlite) {
  globalForDb.sqlite = new Database("./data/jamjar.db");
  globalForDb.sqlite.pragma("journal_mode = WAL");
  globalForDb.sqlite.pragma("foreign_keys = ON");
}

if (!globalForDb.db) {
  globalForDb.db = drizzle(globalForDb.sqlite, { schema });
}

export const db = globalForDb.db;
