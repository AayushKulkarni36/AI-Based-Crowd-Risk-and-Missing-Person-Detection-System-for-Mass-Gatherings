import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/auth.routes.js';
import videoRoutes from './routes/video.routes.js';
import personRoutes from './routes/person.routes.js';
import statsRoutes from './routes/stats.routes.js';
import facematchRoutes from './routes/facematch.routes.js';
import chatRoutes from './routes/chat.routes.js';
import errorHandler from './middleware/error.js';
import initializeSocketIO from './socket.js';
import logger from './utils/logger.js';

// Start BullMQ worker (background process)
import './workers/video.worker.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load backend .env first, then root .env as fallback
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================================================
// SECURITY MIDDLEWARE
// ============================================================================
app.use(helmet());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 600, // raised — dashboard polls stats every 30s
  skip: (req) =>
    req.path.startsWith('/api/video/results/') ||
    req.path.startsWith('/api/stats/') ||
    req.path === '/api/health',
  message: 'Too many requests from this IP, please try again later.'
});

app.use('/api/', limiter);

// ============================================================================
// CORE MIDDLEWARE
// ============================================================================
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================================================
// STATIC ASSETS
// ============================================================================
app.use('/uploads', express.static(path.join(__dirname, '../data/uploads')));
app.use('/uploads/photos', express.static(path.join(__dirname, '../data/uploads/photos')));
app.use('/uploads/videos', express.static(path.join(__dirname, '../data/uploads/videos')));
app.use('/results', express.static(path.join(__dirname, '../data/results')));

// ============================================================================
// VIDEO STREAMING ENDPOINT
// ============================================================================
import fs from 'fs';
app.get('/video/:filename', (req, res) => {
  const videoPath = path.join(__dirname, '../data/results', req.params.filename);
  if (!fs.existsSync(videoPath)) {
    return res.status(404).send('Video not found');
  }

  const stat = fs.statSync(videoPath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(videoPath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4',
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4',
    };
    res.writeHead(200, head);
    fs.createReadStream(videoPath).pipe(res);
  }
});

// ============================================================================
// ROUTES
// ============================================================================
app.use('/api/auth', authRoutes);
app.use('/api/video', videoRoutes);
app.use('/api/persons', personRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/facematch', facematchRoutes);
app.use('/api/chat', chatRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Backend running',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({ success: false, error: 'Not Found' });
});

// ============================================================================
// ERROR HANDLER
// ============================================================================
app.use(errorHandler);

// ============================================================================
// HTTP SERVER & SOCKET.IO
// ============================================================================
const httpServer = http.createServer(app);
const io = initializeSocketIO(httpServer);

// ============================================================================
// SERVER STARTUP
// ============================================================================
httpServer.listen(PORT, () => {
  logger.info(`✅ Backend running on http://localhost:${PORT}`);
  logger.info(`📡 Socket.io listening on /events namespace`);
});

import pool from './config/db.js';

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================
async function gracefulShutdown(signal) {
  logger.info(`${signal} received, shutting down gracefully...`);
  httpServer.close(async () => {
    try { await pool.end(); } catch (_) {}
    logger.info('✓ HTTP server and DB pool closed');
    process.exit(0);
  });
  // Force exit after 10s if graceful shutdown hangs
  setTimeout(() => process.exit(1), 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export { app, httpServer, io };

