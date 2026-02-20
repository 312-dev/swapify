// Plain JS migration script for Docker release_command (no tsx needed)
// Production only — always uses node-postgres (DATABASE_URL required)
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

if (!process.env.DATABASE_URL) {
  console.log('No DATABASE_URL set, skipping migrations (local dev uses tsx version)');
  process.exit(0);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

try {
  console.log('Running migrations against PostgreSQL...');
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('Migrations complete!');
} catch (err) {
  console.error('Migration failed:', err);
  process.exit(1);
} finally {
  await pool.end();
}
