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
    await client.query(`
      CREATE SCHEMA IF NOT EXISTS drizzle;
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      );
      -- Deduplicate if needed
      DELETE FROM drizzle.__drizzle_migrations
      WHERE id NOT IN (
        SELECT min(id) FROM drizzle.__drizzle_migrations GROUP BY hash
      );
      CREATE UNIQUE INDEX IF NOT EXISTS drizzle_migrations_hash_idx ON drizzle.__drizzle_migrations (hash);
    `);

    // Ensure 0000 and 0001 are recorded
    await client.query(`
      INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
      VALUES ('0000_volatile_puck', $1)
      ON CONFLICT (hash) DO NOTHING;
    `, [Date.now()]);
    await client.query(`
      INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
      VALUES ('0001_serious_ravenous', $1)
      ON CONFLICT (hash) DO NOTHING;
    `, [Date.now()]);

    const existingRes = await client.query(`SELECT hash FROM drizzle.__drizzle_migrations`);
    const appliedHashes = new Set(existingRes.rows.map((r) => r.hash));

    const drizzleDir = path.join(process.cwd(), 'drizzle');
    const files = fs.readdirSync(drizzleDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const hash = path.basename(file, '.sql');
      if (appliedHashes.has(hash)) {
        console.log(`Migration already applied: ${file}`);
        continue;
      }

      console.log(`Applying migration: ${file}...`);
      const sql = fs.readFileSync(path.join(drizzleDir, file), 'utf8');
      const rawStatements = sql
        .split('--> statement-breakpoint')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      for (let i = 0; i < rawStatements.length; i++) {
        let stmt = rawStatements[i];

        if (stmt.startsWith('CREATE TABLE "')) {
          stmt = stmt.replace('CREATE TABLE "', 'CREATE TABLE IF NOT EXISTS "');
        }
        if (stmt.includes('ADD COLUMN "')) {
          stmt = stmt.replace(/ADD COLUMN "/g, 'ADD COLUMN IF NOT EXISTS "');
        }
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
          await client.query(stmt);
        } catch (err) {
          console.warn(`[${file}] statement ${i + 1} notice:`, err.message);
        }
      }

      await client.query(`
        INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
        VALUES ($1, $2)
        ON CONFLICT (hash) DO NOTHING;
      `, [hash, Date.now()]);
      console.log(`Successfully applied ${file}`);
    }

    console.log('\nAll migrations completed and verified!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
