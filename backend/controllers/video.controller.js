import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';
import { spawnPythonProcess } from '../utils/python.executor.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============================================================================
// IN-MEMORY JOB STORE (no database)
// ============================================================================
const jobs = new Map();

/**
 * POST /api/video/upload
 * Save uploaded video, return job ID
 * NO database calls
 */
export async function uploadVideo(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No video file provided' });
    }

    const jobId = Date.now().toString();

    jobs.set(jobId, {
      id: jobId,
      filename: req.file.originalname,
      filePath: req.file.path,
      status: 'UPLOADED',
      results: null,
      error: null,
      uploadedAt: new Date()
    });

    logger.info(`Video uploaded: ${req.file.originalname} → job ${jobId}`);

    return res.json({
      success: true,
      videoId: jobId,
      filename: req.file.originalname,
      message: 'Video uploaded successfully'
    });
  } catch (error) {
    logger.error('Upload failed:', error.message);
    return next(error);
  }
}

/**
 * POST /api/video/process/:videoId
 * Start processing video, return immediately
 * Processing happens in background
 * NO database calls
 */
export async function processVideo(req, res, next) {
  try {
    const { videoId } = req.params;
    const job = jobs.get(videoId);

    if (!job) {
      return res.status(404).json({ success: false, error: 'Video not found' });
    }

    if (job.status === 'processing' || job.status === 'completed') {
      return res.status(202).json({
        success: true,
        message: `Already ${job.status}`,
        videoId,
        status: job.status
      });
    }

    // Mark as processing
    job.status = 'PROCESSING';
    job.startedAt = new Date();

    // Return immediately
    res.status(202).json({
      success: true,
      message: 'Processing started',
      videoId,
      status: 'PROCESSING'
    });

    // Run Python in background (do not await)
    _runPython(videoId, job.filePath).catch((err) => {
      const j = jobs.get(videoId);
      if (j) {
        j.status = 'failed';
        j.error = err.message;
      }
      logger.error(`Job ${videoId} failed:`, err.message);
    });

  } catch (error) {
    logger.error('processVideo failed:', error.message);
    return next(error);
  }
}

/**
 * Internal: Run Python detection in background
 */
async function _runPython(videoId, filePath) {
  const job = jobs.get(videoId);
  if (!job) return;

  try {
    logger.info(`Starting Python processing for job ${videoId}`);

    const results = await spawnPythonProcess(filePath, (progress) => {
      if (job) {
        job.progress = progress;
      }
    });

    job.results = results;
    job.status = 'COMPLETED';
    job.completedAt = new Date();

    logger.info(`Job ${videoId} completed: ${results.totalPeople} people, risk ${results.riskLevel}`);
  } catch (err) {
    job.status = 'FAILED';
    job.error = err.message;
    logger.error(`Job ${videoId} failed:`, err.message);
    throw err;
  }
}

/**
 * GET /api/video/results/:videoId
 * Get job status and results
 * NO database calls
 */
export async function getResults(req, res, next) {
  try {
    const { videoId } = req.params;
    const job = jobs.get(videoId);

    if (!job) {
      return res.status(404).json({ success: false, error: 'Video job not found' });
    }

    if (job.status === 'failed') {
      return res.status(500).json({
        success: false,
        status: job.status,
        error: job.error
      });
    }

    return res.json({
      success: true,
      status: job.status,
      progress: job.progress || 0,
      results: job.results,
      uploadedAt: job.uploadedAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt
    });
  } catch (error) {
    logger.error('getResults failed:', error.message);
    return next(error);
  }
}

/**
 * GET /api/video/list
 * List all jobs (for debugging)
 */
export async function listVideos(req, res, next) {
  try {
    const jobsArray = Array.from(jobs.values()).map(job => ({
      id: job.id,
      filename: job.filename,
      status: job.status,
      uploadedAt: job.uploadedAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      hasResults: !!job.results
    }));

    return res.json({
      success: true,
      jobs: jobsArray,
      total: jobsArray.length
    });
  } catch (error) {
    logger.error('listVideos failed:', error.message);
    return next(error);
  }
}
