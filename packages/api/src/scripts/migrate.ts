import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getPool, closePool } from '../shared/db/pool.js';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate(): Promise<void> {
  const pool = getPool();
  const migrationsDir = join(__dirname, '../../migrations');

  const migrations = [
    '001_initial_schema.sql',
  ];

  for (const file of migrations) {
    const sql = readFileSync(join(migrationsDir, file), 'utf-8');
    console.log(`Running migration: ${file}`);
    await pool.query(sql);
    console.log(`Done: ${file}`);
  }

  await closePool();
  console.log('All migrations complete');
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
