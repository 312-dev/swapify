/**
 * Validate all Drizzle migrations against a temporary PGlite instance.
 * Catches issues like missing statement-breakpoints, syntax errors, etc.
 * Runs against an ephemeral in-memory database — does NOT touch your dev data.
 */
import 'dotenv/config';

async function main() {
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const { migrate } = await import('drizzle-orm/pglite/migrator');

  // Use in-memory PGlite so we don't touch the dev database
  const client = new PGlite();
  const db = drizzle(client);

  console.log('Validating migrations against ephemeral PGlite...');

  try {
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('All migrations valid!');
  } catch (err) {
    console.error('Migration validation failed:', err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('Migration validation error:', err);
  process.exit(1);
});
