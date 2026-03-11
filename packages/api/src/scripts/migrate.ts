import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getPool, closePool } from '../shared/db/pool.js';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));

const migrationsDir = join(__dirname, '../../migrations');
const migrations = readdirSync(migrationsDir)
  .filter(f => /^\d{3}_.*\.sql$/.test(f))
  .sort();

async function migrate(): Promise<void> {
  const pool = getPool();

  // Create migrations tracking table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name       VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const { rows } = await pool.query<{ name: string }>('SELECT name FROM _migrations');
  const applied = new Set(rows.map(r => r.name));

  for (const file of migrations) {
    if (applied.has(file)) {
      console.log(`Skipping (already applied): ${file}`);
      continue;
    }
    const sql = readFileSync(join(migrationsDir, file), 'utf-8');
    console.log(`Running: ${file}`);
    await pool.query(sql);
    await pool.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
    console.log(`Done: ${file}`);
  }

  await closePool();
  console.log('All migrations complete');
}

migrate().catch((err) => { console.error(err); process.exit(1); });
