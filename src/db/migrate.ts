import 'dotenv/config';
import { cleanPgliteLock, markCleanShutdown, wipePgliteData } from './pglite-lock';

async function migratePglite(dataPath: string) {
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const { migrate } = await import('drizzle-orm/pglite/migrator');
  cleanPgliteLock(dataPath);
  const client = new PGlite(dataPath);
  const db = drizzle(client);
  console.log('Running migrations against PGlite...');
  await migrate(db, { migrationsFolder: './drizzle' });
  await client.close();
  markCleanShutdown(dataPath);
}

async function main() {
  if (process.env.DATABASE_URL) {
    // Production: node-postgres
    const { drizzle } = await import('drizzle-orm/node-postgres');
    const { migrate } = await import('drizzle-orm/node-postgres/migrator');
    const pg = await import('pg');
    const pool = new pg.default.Pool({
      connectionString: process.env.DATABASE_URL,
    });
    const db = drizzle(pool);
    console.log('Running migrations against PostgreSQL...');
    await migrate(db, { migrationsFolder: './drizzle' });
    await pool.end();
  } else {
    const dataPath = process.env.DATABASE_PATH ?? './data/swapify-pg';
    try {
      await migratePglite(dataPath);
    } catch {
      // PGlite data is likely corrupted from a dirty shutdown.
      // Wipe and recreate — local dev data is always rebuildable from migrations.
      console.warn('PGlite data appears corrupted, wiping and recreating...');
      wipePgliteData(dataPath);
      await migratePglite(dataPath);
    }
  }
  console.log('Migrations complete!');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
