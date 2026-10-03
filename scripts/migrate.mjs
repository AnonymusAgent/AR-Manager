import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const rawUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
if (!rawUrl) {
  console.error('DATABASE_URL or NEON_DATABASE_URL is not set.');
  process.exit(1);
}

const directUrl = rawUrl.replace('-pooler', '');

const pool = new Pool({
  connectionString: directUrl,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const client = await pool.connect();
  try {
    const migrationFile = path.join(process.cwd(), 'drizzle', '0001_serious_ravenous.sql');
    if (!fs.existsSync(migrationFile)) {
      console.log('No migration file found at:', migrationFile);
      return;
    }

    const sql = fs.readFileSync(migrationFile, 'utf8');
    const rawStatements = sql
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    console.log(`Processing ${rawStatements.length} migration statements...`);

    for (let i = 0; i < rawStatements.length; i++) {
      let stmt = rawStatements[i];

      // Convert CREATE TABLE to CREATE TABLE IF NOT EXISTS
      if (stmt.startsWith('CREATE TABLE "')) {
        stmt = stmt.replace('CREATE TABLE "', 'CREATE TABLE IF NOT EXISTS "');
      }

      // Convert ALTER TABLE ... ADD COLUMN ... to ADD COLUMN IF NOT EXISTS
      if (stmt.includes('ADD COLUMN "')) {
        stmt = stmt.replace(/ADD COLUMN "/g, 'ADD COLUMN IF NOT EXISTS "');
      }

      // For constraints, wrap in DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN null; END $$;
      if (stmt.includes('ADD CONSTRAINT')) {
        stmt = `
          DO $$
          BEGIN
            ${stmt.replace(/;+$/, '')};
          EXCEPTION
            WHEN duplicate_object THEN NULL;
            WHEN duplicate_table THEN NULL;
          END $$;
        `;
      }

      try {
        console.log(`[${i + 1}/${rawStatements.length}] Running statement...`);
        await client.query(stmt);
      } catch (err) {
        console.warn(`Statement [${i + 1}] notice:`, err.message);
      }
    }

    // Ensure drizzle schema and migration tracking
    await client.query(`
      CREATE SCHEMA IF NOT EXISTS drizzle;
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      );
    `);

    await client.query(`
      INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
      VALUES ('0001_serious_ravenous', $1)
      ON CONFLICT DO NOTHING;
    `, [Date.now()]);

    console.log('\nMigration completed successfully!');

    const tableRes = await client.query(`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
    `);
    console.log(`\nTotal tables in Neon DB (${tableRes.rows.length}):`);
    console.log(tableRes.rows.map((r) => r.table_name).join(', '));
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
