import 'dotenv/config';

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
    // Local: PGlite
    const { PGlite } = await import('@electric-sql/pglite');
    const { drizzle } = await import('drizzle-orm/pglite');
    const { migrate } = await import('drizzle-orm/pglite/migrator');
    const dataPath = process.env.DATABASE_PATH ?? './data/swapify-pg';
    const client = new PGlite(dataPath);
    const db = drizzle(client);
    console.log('Running migrations against PGlite...');
    await migrate(db, { migrationsFolder: './drizzle' });
    await client.close();
  }
  console.log('Migrations complete!');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
