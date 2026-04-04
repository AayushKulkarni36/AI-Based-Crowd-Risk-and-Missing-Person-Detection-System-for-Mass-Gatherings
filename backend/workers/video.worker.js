import { Worker } from 'bullmq';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import { spawn } from 'child_process';
import pool from '../config/db.js';
import { redisConfig } from '../config/redis.js';
import logger from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const PYTHON_SCRIPT = path.resolve(__dirname, '../../src/crowd_detection/testSimple.py');
const VENV_PYTHON = path.resolve(__dirname, '../../venv/Scripts/python.exe');

// ============================================================================
// PYTHON PROCESS EXECUTION
// ============================================================================

function spawnPythonProcess(videoPath, jobProgressCallback, options = {}) {
  return new Promise((resolve, reject) => {
    const pythonArgs = [
      PYTHON_SCRIPT,
      '--video', videoPath,
      '--json',
    ];

    if (options.faceMatch) {
      pythonArgs.push('--face-match');
    }

    // Use venv python if available, otherwise fallback to system python
    const pythonBin = fs.existsSync(VENV_PYTHON) ? VENV_PYTHON : 'python';

    const pythonProcess = spawn(pythonBin, pythonArgs, {
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      const chunk = data.toString();
      stdout += chunk;

      // Parse PROGRESS:N lines for job progress
      const progressMatch = chunk.match(/PROGRESS:(\d+)/);
      if (progressMatch && jobProgressCallback) {
        const progress = parseInt(progressMatch[1]);
        jobProgressCallback(progress);
      }
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      logger.debug(`[Python stderr] ${data.toString().trim()}`);
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python process exited with code ${code}: ${stderr.slice(-500)}`));
        return;
      }

      // Extract JSON from stdout — look for the last valid JSON object
      const jsonMatches = stdout.match(/\{[\s\S]*"totalPeople"[\s\S]*\}/);
      if (jsonMatches) {
        try {
          const results = JSON.parse(jsonMatches[0]);
          resolve(results);
          return;
        } catch (e) {
          // fall through to full parse
        }
      }

      try {
        // Try parsing entire stdout as JSON
        const trimmed = stdout.trim();
        const results = JSON.parse(trimmed);
        resolve(results);
      } catch (parseErr) {
        logger.warn('[Worker] Could not parse Python JSON output, using fallback');
        resolve({
          totalPeople: 0,
          avgPeoplePerFrame: 0,
          totalFrames: 0,
          maxPeople: 0,
          riskLevel: 'UNKNOWN',
          faceMatches: []
        });
      }
    });

    pythonProcess.on('error', (err) => {
      reject(new Error(`Failed to spawn Python process: ${err.message}`));
    });
  });
}

// ============================================================================
// BULLMQ WORKER
// ============================================================================

const worker = new Worker('video-processing', async (job) => {
  logger.info(`[Worker] Processing job ${job.id}...`);

  const { videoPath, videoJobId, uploadedBy, faceMatch } = job.data;

  try {
    // Update job status to PROCESSING
    await pool.query(
      'UPDATE video_jobs SET status = $1, processing_started_at = NOW() WHERE id = $2',
      ['PROCESSING', videoJobId]
    );

    await job.updateProgress(10);

    // Run Python detection
    const results = await spawnPythonProcess(
      videoPath,
      async (progress) => {
        await job.updateProgress(Math.min(85, 10 + progress * 0.75));
      },
      { faceMatch: !!faceMatch }
    );

    await job.updateProgress(90);

    // Calculate risk level from crowd data
    const totalPeople = results.totalPeople || 0;
    const occupancy = (totalPeople / 40) * 100;
    let riskLevel;
    if (occupancy < 80) riskLevel = 'SAFE';
    else if (occupancy < 95) riskLevel = 'MODERATE';
    else if (occupancy < 110) riskLevel = 'RISKY';
    else riskLevel = 'CRITICAL';

    // Store results — real schema uses results_json as jsonb
    await pool.query(
      `UPDATE video_jobs
       SET status = $1,
           total_people = $2,
           avg_density = $3,
           risk_level = $4,
           face_matches_count = $5,
           heatmap_grid = $6,
           results_json = $7,
           processing_completed_at = NOW(),
           progress = 100
       WHERE id = $8`,
      [
        'COMPLETED',
        totalPeople,
        results.avgPeoplePerFrame || 0,
        riskLevel,
        results.faceMatches ? results.faceMatches.length : 0,
        JSON.stringify(results.crowdHeatmapGrid || []),
        JSON.stringify(results),
        videoJobId
      ]
    );

    // Insert alert log — real schema: timestamp, alert_type, risk_level, person_count, message
    await pool.query(
      `INSERT INTO alert_logs (timestamp, alert_type, risk_level, person_count, message)
       VALUES (NOW(), $1, $2, $3, $4)`,
      [
        'CROWD_DETECTION',
        riskLevel,
        totalPeople,
        `Crowd detection completed: ${totalPeople} people detected (${riskLevel})`
      ]
    );

    // Store face matches if any
    if (Array.isArray(results.faceMatches) && results.faceMatches.length > 0) {
      for (const match of results.faceMatches) {
        try {
          await pool.query(
            `INSERT INTO face_matches (video_job_id, missing_person_id, confidence, frame_number, status)
             VALUES ($1, $2, $3, $4, $5)`,
            [videoJobId, match.personId, match.confidence, match.frameNumber, 'POSSIBLE_MATCH']
          );

          // Update missing person status
          await pool.query(
            'UPDATE missing_persons SET status = $1 WHERE id = $2',
            ['POSSIBLE_MATCH', match.personId]
          );
        } catch (matchErr) {
          logger.warn(`[Worker] Failed to save face match: ${matchErr.message}`);
        }
      }
    }

    await job.updateProgress(100);

    logger.info(`[Worker] Job ${job.id} completed — ${totalPeople} people, risk: ${riskLevel}`);

    return {
      success: true,
      videoJobId,
      results: {
        totalPeople,
        avgPeoplePerFrame: results.avgPeoplePerFrame || 0,
        riskLevel,
        faceMatches: results.faceMatches || []
      },
      riskLevel
    };
  } catch (error) {
    logger.error(`[Worker] Job ${job.id} failed: ${error.message}`);

    try {
      await pool.query(
        'UPDATE video_jobs SET status = $1, error_message = $2 WHERE id = $3',
        ['FAILED', error.message.slice(0, 1000), videoJobId]
      );
    } catch (dbErr) {
      logger.error('Failed to update job status on failure:', dbErr.message);
    }

    throw error;
  }
}, {
  connection: redisConfig,
  concurrency: 1
});

worker.on('progress', (job, progress) => {
  logger.debug(`[Worker] Job ${job.id} progress: ${progress}%`);
});

worker.on('completed', (job) => {
  logger.info(`[Worker] Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  logger.error(`[Worker] Job ${job.id} failed: ${err.message}`);
});

worker.on('error', (err) => {
  logger.error('[Worker Error]', err.message);
});

export default worker;
