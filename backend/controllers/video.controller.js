import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/db.js';
import { videoQueue } from '../queues/video.queue.js';
import logger from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function uploadVideo(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No video file provided' });
    }

    const userId = req.user?.id ?? null;

    const result = await pool.query(
      `INSERT INTO video_jobs (filename, file_path, status, uploaded_by, uploaded_at)
       VALUES ($1, $2, 'UPLOADED', $3, NOW())
       RETURNING id, filename`,
      [req.file.filename, req.file.path, userId]
    );

    const videoJobId = result.rows[0].id;

    logger.info(`Video uploaded: ${req.file.filename} → job ${videoJobId}`);

    return res.json({
      success: true,
      videoJobId,
      filename: req.file.filename,
      message: 'Video uploaded successfully'
    });
  } catch (error) {
    logger.error('Video upload failed:', error.message);
    return next(error);
  }
}

export async function processVideo(req, res, next) {
  try {
    const { videoId } = req.params;

    const videoResult = await pool.query(
      'SELECT id, filename, file_path, status FROM video_jobs WHERE id = $1',
      [videoId]
    );

    if (videoResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Video not found' });
    }

    const videoJob = videoResult.rows[0];

    if (videoJob.status === 'PROCESSING' || videoJob.status === 'COMPLETED') {
      return res.status(202).json({
        success: true,
        message: 'Video is already processing or completed',
        videoId,
        status: videoJob.status
      });
    }

    // Enqueue in BullMQ
    const job = await videoQueue.add(
      'process-video',
      {
        videoPath: videoJob.file_path,
        videoJobId: videoJob.id,
        uploadedBy: req.user?.id,
        faceMatch: req.body?.faceMatch || false
      },
      {
        jobId: `video-${videoJob.id}`,
        priority: 1
      }
    );

    await pool.query(
      "UPDATE video_jobs SET status = 'QUEUED' WHERE id = $1",
      [videoJob.id]
    );

    logger.info(`Video job ${videoJob.id} queued as BullMQ job ${job.id}`);

    return res.status(202).json({
      success: true,
      message: 'Video processing started',
      videoId,
      jobId: job.id,
      status: 'QUEUED'
    });
  } catch (error) {
    logger.error('processVideo failed:', error.message);
    return next(error);
  }
}

export async function getResults(req, res, next) {
  try {
    const { videoId } = req.params;

    const result = await pool.query(
      `SELECT
         id, filename, status, progress, total_people, avg_density,
         risk_level, face_matches_count, results_json, error_message,
         output_video_path,
         uploaded_at, processing_started_at, processing_completed_at
       FROM video_jobs
       WHERE id = $1`,
      [videoId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Video job not found' });
    }

    const job = result.rows[0];

    // results_json is stored as jsonb, comes back as object already
    const parsedResults = job.results_json || {};

    return res.json({
      success: true,
      status: job.status,
      progress: job.progress || 0,
      results: {
        totalPeople: job.total_people,
        avgPeoplePerFrame: job.avg_density,
        riskLevel: job.risk_level,
        faceMatches: job.face_matches_count || 0,
        outputVideoPath: job.output_video_path,
        ...parsedResults
      },
      uploadedAt: job.uploaded_at,
      processingStartedAt: job.processing_started_at,
      processingCompletedAt: job.processing_completed_at,
      error: job.error_message
    });
  } catch (error) {
    logger.error('getResults failed:', error.message);
    return next(error);
  }
}

export async function listVideos(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const offset = parseInt(req.query.offset) || 0;

    const result = await pool.query(
      `SELECT
         id, filename, status, total_people, risk_level, uploaded_at,
         processing_completed_at, face_matches_count, progress
       FROM video_jobs
       ORDER BY uploaded_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return res.json({ success: true, videos: result.rows, limit, offset });
  } catch (error) {
    logger.error('listVideos failed:', error.message);
    return next(error);
  }
}
