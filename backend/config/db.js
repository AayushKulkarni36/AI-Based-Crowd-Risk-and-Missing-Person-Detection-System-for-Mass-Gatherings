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
  // ── Connection pool tuning ──────────────────────────────────────────────
  max: Number(process.env.DB_POOL_MAX || 10),
  min: 2,                                          // keep 2 warm connections always
  idleTimeoutMillis: 0,                             // NEVER kill idle clients (prevents the 2-min drop)
  connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS || 10000),
  allowExitOnIdle: false,                           // don't let pool shut down when idle
  // ── TCP Keep-alive ──────────────────────────────────────────────────────
  keepAlive: true,
  keepAliveInitialDelayMillis: 30000,               // 30s before first TCP keep-alive probe
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
    await new Promise((resolve) => setTimeout(resolve, 500));
    return originalQuery(text, params);
  }
};

// ── Periodic health probe ──────────────────────────────────────────────────
// Runs every 45 seconds to keep at least one connection alive and detect
// problems early, before a real request arrives and fails.
setInterval(async () => {
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    console.error('❌ PostgreSQL health probe failed:', err.message);
  }
}, 45_000);

// Single startup probe — logs ONCE when the module first loads.
pool.query('SELECT 1')
  .then(() => console.log('✅ PostgreSQL pool ready'))
  .catch((err) => console.error('❌ PostgreSQL pool failed to connect:', err));

export default pool;
