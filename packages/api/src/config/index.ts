import 'dotenv/config';

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const config = {
  nodeEnv: optional('NODE_ENV', 'development'),
  isDev: optional('NODE_ENV', 'development') === 'development',
  port: parseInt(optional('PORT', '3001'), 10),

  jwt: {
    secret: required('JWT_SECRET'),
    expiresIn: optional('JWT_EXPIRES_IN', '7d'),
  },

  database: {
    url: process.env['DATABASE_URL'],
    host: optional('DB_HOST', 'localhost'),
    port: parseInt(optional('DB_PORT', '5432'), 10),
    name: optional('DB_NAME', 'alashed_tracker'),
    user: optional('DB_USER', 'postgres'),
    password: optional('DB_PASSWORD', 'postgres'),
    ssl: optional('DB_SSL', 'false') === 'true',
  },

  cors: {
    allowedOrigins: optional('CORS_ORIGINS', 'http://localhost:3000').split(','),
  },

  apiBaseUrl: optional('API_BASE_URL', 'http://localhost:3001'),
  mcpBaseUrl: optional('MCP_BASE_URL', 'http://localhost:3002'),
  webBaseUrl: optional('WEB_BASE_URL', 'http://localhost:3000'),
  clerkSecretKey: optional('CLERK_SECRET_KEY', ''),
} as const;

export function validateConfig(): void {
  required('JWT_SECRET');
  if (!process.env['DATABASE_URL'] && !process.env['DB_HOST']) {
    throw new Error('Either DATABASE_URL or DB_HOST must be set');
  }
}
