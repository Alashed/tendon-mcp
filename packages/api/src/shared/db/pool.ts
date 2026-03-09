import { Pool, QueryResult, QueryResultRow } from 'pg';
import { config } from '../../config/index.js';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const ssl = config.database.ssl ? { rejectUnauthorized: false } : false;
    const sslOption = config.database.ssl ? { rejectUnauthorized: false } : false;
    pool = new Pool(
      config.database.url
        ? { connectionString: config.database.url, ssl: sslOption }
        : {
            host: config.database.host,
            port: config.database.port,
            database: config.database.name,
            user: config.database.user,
            password: config.database.password,
            ssl: sslOption,
          },
    );
    Object.assign(pool, { max: 20, idleTimeoutMillis: 30000, connectionTimeoutMillis: 10000 });
    pool.on('error', (err) => console.error('Idle pool client error:', err));
  }
  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params);
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
