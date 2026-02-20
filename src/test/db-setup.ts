import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from '@/db/schema';
import { sql } from 'drizzle-orm';
import path from 'path';

type TestDb = ReturnType<typeof drizzle<typeof schema>>;

let client: PGlite;
let testDb: TestDb;

export async function setupTestDb(): Promise<TestDb> {
  // Create in-memory PGlite
  client = new PGlite();
  testDb = drizzle(client, { schema });

  // Run migrations
  const migrationsFolder = path.resolve(process.cwd(), 'drizzle');
  await migrate(drizzle(client), { migrationsFolder });

  return testDb;
}

export async function teardownTestDb(): Promise<void> {
  if (client) {
    await client.close();
  }
}

export async function truncateAllTables(db: TestDb): Promise<void> {
  // Truncate in reverse dependency order
  await db.execute(
    sql`TRUNCATE TABLE push_subscriptions, email_invites, track_reactions, track_listens, playlist_tracks, playlist_members, playlists, circle_members, circles, users CASCADE`
  );
}

export function getTestDb(): TestDb {
  return testDb;
}
