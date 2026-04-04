import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import readline from 'readline';
import pool from '../config/db.js';
import logger from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * POST /api/facematch/run
 * Run face matching on a completed video job
 */
export async function runFaceMatch(req, res, next) {
  try {
    const { jobId } = req.body;

    if (!jobId) {
      return res.status(400).json({ success: false, error: 'jobId required' });
    }

    // Verify job exists and is completed
    const jobResult = await pool.query(
      'SELECT id, filename, file_path, status FROM video_jobs WHERE id = $1',
      [jobId]
    );

    if (jobResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    const job = jobResult.rows[0];

    if (job.status !== 'COMPLETED') {
      return res.status(400).json({
        success: false,
        error: `Job must be completed. Current status: ${job.status}`
      });
    }

    // Check if there are any enrolled active persons
    const personsResult = await pool.query(
      `SELECT COUNT(*) as count FROM missing_persons
       WHERE status = 'ACTIVE' AND face_vector IS NOT NULL`
    );

    const enrolledCount = parseInt(personsResult.rows[0].count);
    if (enrolledCount === 0) {
      logger.info(`No enrolled persons to match against for job ${jobId}`);
      return res.json({
        success: true,
        message: 'No enrolled persons to match against',
        matches: [],
        totalMatches: 0
      });
    }

    logger.info(`Starting face match for job ${jobId} against ${enrolledCount} persons`);

    // Spawn Python match_video.py
    const pythonPath = process.env.PYTHON_PATH ||
      path.join(__dirname, '../../venv/Scripts/python.exe');
    const scriptPath = path.join(__dirname, '../../src/face_recognition/match_video.py');

    const dbHost = process.env.DB_HOST || 'localhost';
    const dbName = process.env.DB_NAME || 'missing_persons';
    const dbUser = process.env.DB_USER || 'postgres';
    const dbPassword = process.env.DB_PASSWORD || 'postgres123';

    const args = [
      scriptPath,
      '--video', job.file_path,
      '--job-id', jobId,
      '--db-host', dbHost,
      '--db-name', dbName,
      '--db-user', dbUser,
      '--db-password', dbPassword,
      '--threshold', '0.6',
      '--skip', '6',
      '--json'
    ];

    const python = spawn(pythonPath, args, {
      cwd: path.dirname(scriptPath),
      stdio: ['inherit', 'pipe', 'pipe']
    });

    let jsonBuffer = '';
    let stderr = '';
    const matches = [];

    // Setup readline for line-by-line stdout processing
    const rl = readline.createInterface({
      input: python.stdout,
      crlfDelay: Infinity
    });

    // Process each line
    rl.on('line', (line) => {
      // Check for MATCH lines (real-time face matches)
      if (line.startsWith('MATCH:')) {
        const parts = line.split(':');
        if (parts.length >= 5) {
          const personId = parseInt(parts[1]);
          const personName = parts[2];
          const confidence = parseFloat(parts[3]);
          const frameNum = parseInt(parts[4]);

          matches.push({
            person_id: personId,
            person_name: personName,
            confidence: confidence,
            frame_number: frameNum
          });

          logger.info(`Face match found: ${personName} (${(confidence * 100).toFixed(1)}%) at frame ${frameNum}`);

          // TODO: Emit Socket.io event for real-time notification
          // io.emit('face:match', { jobId, personId, personName, confidence, frameNum });
        }
      }
      // Check for PROGRESS lines
      else if (line.startsWith('PROGRESS:')) {
        const percent = parseInt(line.split(':')[1]);
        // TODO: Emit Socket.io progress event
        // io.emit('facematch:progress', { jobId, progress: percent });
      }
      // Check for JSON output
      else if (line.trim().startsWith('{')) {
        jsonBuffer = line;
      }
    });

    rl.on('close', () => {
      // Handled by python.on('close')
    });

    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Timeout after 30 minutes
    const timeout = setTimeout(() => {
      python.kill('SIGTERM');
      logger.error(`Face matching timeout for job ${jobId}`);
      return res.status(408).json({
        success: false,
        error: 'Face matching timeout after 30 minutes'
      });
    }, 30 * 60 * 1000);

    python.on('close', async (code) => {
      clearTimeout(timeout);

      if (code !== 0) {
        logger.error(`Face matching failed for job ${jobId}: ${stderr.slice(-500)}`);
        return res.status(500).json({
          success: false,
          error: `Python process failed: ${stderr.slice(-200)}`
        });
      }

      try {
        // Store matches in DB
        for (const match of matches) {
          try {
            await pool.query(
              `INSERT INTO face_matches
               (person_id, job_id, frame_number, confidence)
               VALUES ($1, $2, $3, $4)`,
              [match.person_id, jobId, match.frame_number, match.confidence]
            );

            // Update person status to POSSIBLE_MATCH if currently ACTIVE
            await pool.query(
              `UPDATE missing_persons
               SET status = 'POSSIBLE_MATCH'
               WHERE id = $1 AND status = 'ACTIVE'`,
              [match.person_id]
            );

            logger.info(`Stored face match for person ${match.person_id} in job ${jobId}`);
          } catch (matchErr) {
            logger.warn(`Failed to store face match: ${matchErr.message}`);
          }
        }

        return res.json({
          success: true,
          message: matches.length > 0 ? `Found ${matches.length} match(es)` : 'No matches found',
          matches,
          totalMatches: matches.length,
          jsonOutput: jsonBuffer ? JSON.parse(jsonBuffer) : {}
        });

      } catch (parseErr) {
        logger.error(`Error processing face matching results: ${parseErr.message}`);
        return res.json({
          success: true,
          message: 'Face matching completed',
          matches,
          totalMatches: matches.length
        });
      }
    });

    python.on('error', (err) => {
      clearTimeout(timeout);
      logger.error(`Failed to spawn face matching process: ${err.message}`);
      return res.status(500).json({
        success: false,
        error: `Failed to spawn process: ${err.message}`
      });
    });

  } catch (error) {
    logger.error('runFaceMatch failed:', error.message);
    return next(error);
  }
}

/**
 * GET /api/facematch/:jobId
 * Get face matching results for a job
 */
export async function getMatchResults(req, res, next) {
  try {
    const { jobId } = req.params;

    const result = await pool.query(
      `SELECT fm.id, fm.person_id, fm.frame_number, fm.confidence,
              fm.confirmed, fm.confirmed_by, fm.confirmed_at,
              mp.name as person_name
       FROM face_matches fm
       LEFT JOIN missing_persons mp ON fm.person_id = mp.id
       WHERE fm.job_id = $1
       ORDER BY fm.confidence DESC`,
      [jobId]
    );

    return res.json({
      success: true,
      matches: result.rows,
      totalMatches: result.rows.length
    });

  } catch (error) {
    logger.error('getMatchResults failed:', error.message);
    return next(error);
  }
}

/**
 * PUT /api/facematch/:matchId/confirm
 * Confirm a face match as genuine
 */
export async function confirmMatch(req, res, next) {
  try {
    const { matchId } = req.params;
    const userId = req.user?.id ?? null;

    const result = await pool.query(
      `UPDATE face_matches
       SET confirmed = true,
           confirmed_by = $1,
           confirmed_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [userId, matchId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Match not found' });
    }

    const match = result.rows[0];

    // Update person status to FOUND
    await pool.query(
      `UPDATE missing_persons
       SET status = 'FOUND'
       WHERE id = $1`,
      [match.person_id]
    );

    logger.info(`Match ${matchId} confirmed by user ${userId}`);

    return res.json({
      success: true,
      match: result.rows[0],
      message: 'Match confirmed'
    });

  } catch (error) {
    logger.error('confirmMatch failed:', error.message);
    return next(error);
  }
}

/**
 * DELETE /api/facematch/:matchId
 * Mark a match as false positive (keeps person as ACTIVE)
 */
export async function dismissMatch(req, res, next) {
  try {
    const { matchId } = req.params;

    // Fetch the match
    const matchResult = await pool.query(
      'SELECT person_id FROM face_matches WHERE id = $1',
      [matchId]
    );

    if (matchResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Match not found' });
    }

    const personId = matchResult.rows[0].person_id;

    // Delete the match
    await pool.query(
      'DELETE FROM face_matches WHERE id = $1',
      [matchId]
    );

    // Set person back to ACTIVE (was POSSIBLE_MATCH)
    await pool.query(
      `UPDATE missing_persons
       SET status = 'ACTIVE'
       WHERE id = $1 AND status = 'POSSIBLE_MATCH'`,
      [personId]
    );

    logger.info(`Match ${matchId} dismissed`);

    return res.json({
      success: true,
      message: 'Match dismissed'
    });

  } catch (error) {
    logger.error('dismissMatch failed:', error.message);
    return next(error);
  }
}
