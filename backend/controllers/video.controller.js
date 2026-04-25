import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';
import { spawnPythonProcess } from '../utils/python.executor.js';
import pool from '../config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============================================================================
// IN-MEMORY CACHE  (for fast polling — DB is source of truth)
// ============================================================================
const jobCache = new Map(); // videoId (string) → { status, progress, results, error }

// ============================================================================
// HELPERS
// ============================================================================

function cacheSet(videoId, patch) {
  const existing = jobCache.get(String(videoId)) || {};
  jobCache.set(String(videoId), { ...existing, ...patch });
}

function cacheGet(videoId) {
  return jobCache.get(String(videoId)) || null;
}

// ============================================================================
// POST /api/video/upload
// ============================================================================
export async function uploadVideo(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No video file provided' });
    }

    const filePath = req.file.path.replace(/\\/g, '/');
    const filename = req.file.originalname;

    // Insert into DB — this makes the job visible to facematch controller
    let videoId;
    try {
      const dbResult = await pool.query(
        `INSERT INTO video_jobs (filename, file_path, status, progress)
         VALUES ($1, $2, 'UPLOADED', 0)
         RETURNING id`,
        [filename, filePath]
      );
      videoId = dbResult.rows[0].id;
    } catch (dbErr) {
      // DB unavailable — fall back to timestamp ID
      logger.warn(`DB insert failed for upload, using timestamp ID: ${dbErr.message}`);
      videoId = Date.now().toString();
    }

    cacheSet(videoId, {
      id: videoId,
      filename,
      filePath,
      status: 'UPLOADED',
      progress: 0,
      results: null,
      error: null,
      uploadedAt: new Date(),
    });

    logger.info(`Video uploaded: ${filename} → job ${videoId}`);

    return res.json({
      success: true,
      videoId,          // used by routes (:videoId)
      videoJobId: videoId, // kept for frontend compatibility
      filename,
      message: 'Video uploaded successfully',
    });
  } catch (error) {
    logger.error('Upload failed:', error.message);
    return next(error);
  }
}

// ============================================================================
// POST /api/video/process/:videoId
// ============================================================================
export async function processVideo(req, res, next) {
  try {
    const { videoId } = req.params;

    // Check cache first, then DB
    let job = cacheGet(videoId);
    if (!job) {
      try {
        const dbRow = await pool.query(
          'SELECT id, filename, file_path, status FROM video_jobs WHERE id = $1',
          [videoId]
        );
        if (dbRow.rows.length > 0) {
          const r = dbRow.rows[0];
          job = {
            id: r.id,
            filename: r.filename,
            filePath: r.file_path,
            status: r.status,
            progress: 0,
            results: null,
            error: null,
          };
          cacheSet(videoId, job);
        }
      } catch (dbErr) {
        logger.warn(`DB lookup failed for job ${videoId}: ${dbErr.message}`);
      }
    }

    if (!job) {
      return res.status(404).json({ success: false, error: 'Video not found' });
    }

    if (job.status === 'PROCESSING' || job.status === 'COMPLETED') {
      return res.status(202).json({
        success: true,
        message: `Already ${job.status}`,
        videoId,
        status: job.status,
      });
    }

    // Mark as processing
    cacheSet(videoId, { status: 'PROCESSING', startedAt: new Date() });

    try {
      await pool.query(
        `UPDATE video_jobs SET status = 'PROCESSING', processing_started_at = NOW() WHERE id = $1`,
        [videoId]
      );
    } catch (dbErr) {
      logger.warn(`DB status update failed for job ${videoId}: ${dbErr.message}`);
    }

    // Return immediately — processing happens in background
    res.status(202).json({
      success: true,
      message: 'Processing started',
      videoId,
      status: 'PROCESSING',
    });

    // Run Python in background
    _runPython(videoId, job.filePath).catch((err) => {
      cacheSet(videoId, { status: 'FAILED', error: err.message });
      logger.error(`Job ${videoId} failed:`, err.message);
    });

  } catch (error) {
    logger.error('processVideo failed:', error.message);
    return next(error);
  }
}

// ============================================================================
// INTERNAL — run Python detection
// ============================================================================
async function _runPython(videoId, filePath) {
  const cached = cacheGet(videoId);
  if (!cached) return;

  try {
    logger.info(`Starting Python processing for job ${videoId}: ${filePath}`);

    const results = await spawnPythonProcess(filePath, (progress) => {
      cacheSet(videoId, { progress });
    });

    // Classify risk
    const totalPeople = results.totalPeople || 0;
    const outputVideoPath = results.outputVideoPath || null;
    const riskLevel = results.riskLevel || _classifyRisk(totalPeople);

    if (outputVideoPath) {
      const filename = outputVideoPath.split('/').pop();
      results.video_url = `http://localhost:5173/video/${filename}`;
    }

    cacheSet(videoId, {
      status: 'COMPLETED',
      progress: 100,
      results,
      completedAt: new Date(),
    });

    // Persist to DB
    try {
      await pool.query(
        `UPDATE video_jobs
         SET status = 'COMPLETED',
             total_people = $1,
             avg_density  = $2,
             risk_level   = $3,
             face_matches_count = $4,
             results_json = $5,
             progress     = 100,
             processing_completed_at = NOW()
         WHERE id = $6`,
        [
          totalPeople,
          results.avgPeoplePerFrame || 0,
          riskLevel,
          Array.isArray(results.faceMatches) ? results.faceMatches.length : 0,
          JSON.stringify(results),
          videoId,
        ]
      );

      // Insert alert log
      await pool.query(
        `INSERT INTO alert_logs (timestamp, alert_type, risk_level, person_count, message)
         VALUES (NOW(), $1, $2, $3, $4)`,
        [
          'CROWD_DETECTION',
          riskLevel,
          totalPeople,
          `Crowd detection completed: ${totalPeople} people (${riskLevel})`,
        ]
      );

      // Persist face matches and auto-mark matched persons as FOUND.
      if (Array.isArray(results.faceMatches) && results.faceMatches.length > 0) {
        for (const match of results.faceMatches) {
          const personId = Number(match.personId);
          if (!personId) continue;

          try {
            await pool.query(
              `INSERT INTO face_matches (video_job_id, missing_person_id, confidence, frame_number, status)
               VALUES ($1, $2, $3, $4, $5)`,
              [
                Number(videoId),
                personId,
                Number(match.confidence || match.similarity || 0),
                Number(match.frameNumber || 0),
                'CONFIRMED'
              ]
            );

            await pool.query(
              `UPDATE missing_persons
               SET status = 'FOUND',
                   found_timestamp = COALESCE(found_timestamp, NOW())
               WHERE id = $1 AND status != 'FOUND'`,
              [personId]
            );
          } catch (matchErr) {
            logger.warn(`Failed to persist face match for person ${personId}: ${matchErr.message}`);
          }
        }
      }
    } catch (dbErr) {
      logger.warn(`DB update failed after processing job ${videoId}: ${dbErr.message}`);
    }

    logger.info(`Job ${videoId} completed: ${totalPeople} people, risk ${riskLevel}`);

  } catch (err) {
    cacheSet(videoId, { status: 'FAILED', error: err.message });

    try {
      await pool.query(
        `UPDATE video_jobs SET status = 'FAILED', error_message = $1 WHERE id = $2`,
        [err.message.slice(0, 1000), videoId]
      );
    } catch (_) {}

    logger.error(`Job ${videoId} failed:`, err.message);
    throw err;
  }
}

function _classifyRisk(maxPeople) {
  if (maxPeople < 10) return 'SAFE';
  if (maxPeople < 25) return 'MODERATE';
  if (maxPeople < 50) return 'RISKY';
  return 'CRITICAL';
}

// ============================================================================
// GET /api/video/results/:videoId
// ============================================================================
export async function getResults(req, res, next) {
  try {
    const { videoId } = req.params;

    // Try cache first
    let job = cacheGet(videoId);

    // Fall back to DB
    if (!job || job.status === 'PROCESSING') {
      try {
        const dbRow = await pool.query(
          `SELECT id, status, progress, total_people, avg_density, risk_level,
                  face_matches_count, results_json, error_message,
                  uploaded_at, processing_started_at, processing_completed_at
           FROM video_jobs WHERE id = $1`,
          [videoId]
        );
        if (dbRow.rows.length > 0) {
          const r = dbRow.rows[0];
          const parsedResults = r.results_json ? JSON.parse(r.results_json) : null;

          if (parsedResults && parsedResults.outputVideoPath) {
            const filename = parsedResults.outputVideoPath.split('/').pop();
            parsedResults.video_url = `http://localhost:5173/video/${filename}`;
          }

          // Sync cache
          cacheSet(videoId, {
            status: r.status,
            progress: r.progress || 0,
            results: parsedResults,
            error: r.error_message || null,
          });

          if (r.status === 'FAILED') {
            return res.status(500).json({
              success: false,
              status: r.status,
              error: r.error_message || 'Processing failed',
            });
          }

          return res.json({
            success: true,
            status: r.status,
            progress: r.progress || 0,
            results: parsedResults,
            uploadedAt: r.uploaded_at,
            startedAt: r.processing_started_at,
            completedAt: r.processing_completed_at,
          });
        }
      } catch (dbErr) {
        logger.warn(`DB results fetch failed for job ${videoId}: ${dbErr.message}`);
      }
    }

    if (!job) {
      return res.status(404).json({ success: false, error: 'Video job not found' });
    }

    if (job.status === 'FAILED') {
      return res.status(500).json({
        success: false,
        status: job.status,
        error: job.error,
      });
    }

    if (job.results && job.results.outputVideoPath && !job.results.video_url) {
      const filename = job.results.outputVideoPath.split('/').pop();
      job.results.video_url = `http://localhost:5173/video/${filename}`;
    }

    return res.json({
      success: true,
      status: job.status,
      progress: job.progress || 0,
      results: job.results,
      uploadedAt: job.uploadedAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
    });

  } catch (error) {
    logger.error('getResults failed:', error.message);
    return next(error);
  }
}

// ============================================================================
// GET /api/video/list
// ============================================================================
export async function listVideos(req, res, next) {
  try {
    const dbRows = await pool.query(
      `SELECT id, filename, status, progress, total_people, risk_level,
              uploaded_at, processing_completed_at
       FROM video_jobs ORDER BY uploaded_at DESC LIMIT 50`
    );
    return res.json({
      success: true,
      jobs: dbRows.rows,
      total: dbRows.rows.length,
    });
  } catch (error) {
    // Fall back to cache if DB is down
    const jobsArray = Array.from(jobCache.values()).map((j) => ({
      id: j.id,
      filename: j.filename,
      status: j.status,
      uploadedAt: j.uploadedAt,
    }));
    return res.json({ success: true, jobs: jobsArray, total: jobsArray.length });
  }
}
