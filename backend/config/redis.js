import Redis from 'ioredis';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Redis connection configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: Number(process.env.REDIS_DB) || 0,
  retryStrategy: (times) => {
    if (times > 30) {
      // After 30 retries (~1 min), slow down to every 10s
      return 10000;
    }
    const delay = Math.min(times * 200, 5000);
    return delay;
  },
  enableReadyCheck: false,
  enableOfflineQueue: true,
  maxRetriesPerRequest: null,
  // ── Keep-alive to prevent idle disconnections ───────────────────────────
  keepAlive: 30000,           // send TCP keep-alive every 30s
  connectTimeout: 10000,      // 10s connection timeout
  lazyConnect: false,
};

const redis = new Redis(redisConfig);

redis.on('connect', () => {
  console.log('✅ Redis connected');
});

redis.on('error', (err) => {
  // Only log unique/useful errors — avoid spam
  if (err.code !== 'ECONNREFUSED') {
    console.error('❌ Redis error:', err.message);
  }
});

redis.on('close', () => {
  console.log('⚠️  Redis disconnected — will reconnect automatically');
});

redis.on('reconnecting', (delay) => {
  // Silently reconnecting
});

export default redis;
export { redisConfig };
