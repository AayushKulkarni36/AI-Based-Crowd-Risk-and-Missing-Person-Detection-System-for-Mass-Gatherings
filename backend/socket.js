import { Server as SocketServer } from 'socket.io';
import { videoQueue } from './queues/video.queue.js';

/**
 * Initialize Socket.io for real-time event broadcasting
 * Events emitted:
 *  - job:queued      { jobId, timestamp }
 *  - job:processing  { jobId, progress: 0-100, timestamp }
 *  - job:completed   { jobId, results, timestamp }
 *  - job:failed      { jobId, error, timestamp }
 *  - crowd:alert     { jobId, riskLevel, personCount, timestamp }
 *  - face:match      { jobId, personId, name, confidence, frameNumber, timestamp }
 */

// ── Helper: safely fetch queue stats without crashing on Redis errors ──────
async function safeGetQueueStats() {
  try {
    const counts = await videoQueue.getJobCounts();
    return {
      queued: counts.waiting || 0,
      processing: counts.active || 0,
      completed: counts.completed || 0,
      failed: counts.failed || 0,
    };
  } catch (err) {
    console.warn('⚠️ Could not fetch queue stats (Redis may be down):', err.message);
    return { queued: 0, processing: 0, completed: 0, failed: 0 };
  }
}

export function initializeSocketIO(httpServer) {
  const io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true
    },
    // ── Socket.io server-side tuning ─────────────────────────────────────
    pingTimeout: 60000,     // wait 60s before declaring a client dead
    pingInterval: 25000,    // send a ping every 25s to keep connection alive
  });

  const eventNamespace = io.of('/events');

  // =========================================================================
  // CONNECTION HANDLERS
  // =========================================================================

  eventNamespace.on('connection', (socket) => {
    console.log(`✓ Socket.io client connected: ${socket.id}`);

    // Send current queue stats to new client (non-blocking)
    safeGetQueueStats().then((stats) => {
      socket.emit('queue:stats', stats);
    });

    socket.on('disconnect', () => {
      console.log(`✗ Socket.io client disconnected: ${socket.id}`);
    });

    socket.on('error', (error) => {
      console.error(`Socket.io error (${socket.id}):`, error);
    });
  });

  // =========================================================================
  // QUEUE EVENT LISTENERS (emit to all connected clients)
  // =========================================================================

  videoQueue.on('progress', (job, progress) => {
    eventNamespace.emit('job:processing', {
      jobId: job.id,
      progress: Math.min(100, Math.max(0, progress)),
      timestamp: new Date().toISOString()
    });

    // Also update queue stats (non-blocking)
    safeGetQueueStats().then((stats) => {
      eventNamespace.emit('queue:stats', stats);
    });
  });

  videoQueue.on('completed', (job, result) => {
    const crowdData = result.results || {};

    // Emit job completion
    eventNamespace.emit('job:completed', {
      jobId: job.id,
      results: {
        totalPeople: crowdData.totalPeople,
        avgDensity: crowdData.avgPeoplePerFrame,
        riskLevel: crowdData.riskLevel,
        faceMatches: crowdData.faceMatches || []
      },
      timestamp: new Date().toISOString()
    });

    // Emit crowd alert if risk level is elevated
    if (crowdData.riskLevel && crowdData.riskLevel !== 'SAFE') {
      eventNamespace.emit('crowd:alert', {
        jobId: job.id,
        riskLevel: crowdData.riskLevel,
        personCount: crowdData.totalPeople,
        timestamp: new Date().toISOString()
      });
    }

    // Emit face matches if any
    if (Array.isArray(crowdData.faceMatches) && crowdData.faceMatches.length > 0) {
      for (const match of crowdData.faceMatches) {
        eventNamespace.emit('face:match', {
          jobId: job.id,
          personId: match.personId,
          name: match.name,
          confidence: match.confidence,
          frameNumber: match.frameNumber,
          status: match.status,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Update queue stats (non-blocking)
    safeGetQueueStats().then((stats) => {
      eventNamespace.emit('queue:stats', stats);
    });
  });

  videoQueue.on('failed', (job, error) => {
    eventNamespace.emit('job:failed', {
      jobId: job.id,
      error: error.message,
      timestamp: new Date().toISOString()
    });

    // Update queue stats (non-blocking)
    safeGetQueueStats().then((stats) => {
      eventNamespace.emit('queue:stats', stats);
    });
  });

  console.log('✓ Socket.io initialized on /events namespace');

  return io;
}

export default initializeSocketIO;
