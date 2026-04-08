import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Force-load env values from .env so a stale process env doesn't break DB access.
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 30000),
  connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS || 10000),
  keepAlive: true,
  keepAliveInitialDelayMillis: Number(process.env.DB_KEEPALIVE_DELAY_MS || 10000),
  maxUses: Number(process.env.DB_MAX_USES || 7500)
});

// Silent per-connection handler (pool reuses connections; the 'connect'
// event fires for every new physical connection, not every query).
pool.on('connect', () => { /* intentionally silent */ });
pool.on('error', (err) => console.error('❌ PostgreSQL pool error:', err));

const transientErrorCodes = new Set([
  '57P01', // admin_shutdown
  '57P02', // crash_shutdown
  '57P03', // cannot_connect_now
  '53300', // too_many_connections
  'ECONNRESET',
  'ETIMEDOUT',
  'EPIPE'
]);

const originalQuery = pool.query.bind(pool);
pool.query = async function resilientQuery(text, params) {
  try {
    return await originalQuery(text, params);
  } catch (err) {
    const code = err?.code;
    const message = String(err?.message || '');
    const isTransient =
      transientErrorCodes.has(code) ||
      message.includes('Connection terminated unexpectedly') ||
      message.includes('terminating connection') ||
      message.includes('Connection ended unexpectedly');

    if (!isTransient) throw err;

    console.warn(`⚠️ PostgreSQL transient error (${code || 'unknown'}), retrying query once...`);
    await new Promise((resolve) => setTimeout(resolve, 200));
    return originalQuery(text, params);
  }
};

// Single startup probe — logs ONCE when the module first loads.
pool.query('SELECT 1')
  .then(() => console.log('✅ PostgreSQL pool ready'))
  .catch((err) => console.error('❌ PostgreSQL pool failed to connect:', err));

export default pool;
