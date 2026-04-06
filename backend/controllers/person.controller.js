import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import pool from '../config/db.js';
import logger from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============================================================================
// FACE ENROLLMENT HELPER  (awaitable — resolves when Python process closes)
// ============================================================================

/**
 * Run enroll.py and wait for result.
 * @returns {{ success: boolean, embedding: number[]|null, error: string|null }}
 */
function runEnrollment(imagePath) {
  return new Promise((resolve) => {
    const pythonPath =
      process.env.PYTHON_PATH ||
      path.join(__dirname, '../../venv/Scripts/python.exe');
    const enrollScript = path.join(__dirname, '../../src/face_recognition/enroll.py');

    let stdout = '';
    let stderr = '';

    let proc;
    try {
      proc = spawn(pythonPath, [enrollScript, '--image', imagePath], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (spawnErr) {
      return resolve({ success: false, embedding: null, error: spawnErr.message });
    }

    // 60-second timeout
    const timer = setTimeout(() => {
      try { proc.kill(); } catch (_) {}
      resolve({ success: false, embedding: null, error: 'Enrollment timeout (60s)' });
    }, 60_000);

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        return resolve({
          success: false,
          embedding: null,
          error: `enroll.py exited ${code}: ${stderr.slice(-300)}`,
        });
      }
      try {
        const parsed = JSON.parse(stdout.trim());
        if (parsed.success && Array.isArray(parsed.embedding)) {
          return resolve({ success: true, embedding: parsed.embedding, error: null });
        }
        return resolve({ success: false, embedding: null, error: parsed.error || 'No face detected' });
      } catch (parseErr) {
        return resolve({ success: false, embedding: null, error: 'Invalid JSON from enroll.py' });
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      resolve({ success: false, embedding: null, error: err.message });
    });
  });
}

// ============================================================================
// CONTROLLERS
// ============================================================================

export async function getAllPersons(_req, res, next) {
  try {
    const result = await pool.query(
      `SELECT id, name, age, gender, description, photo_path,
              reported_date, last_seen_location, contact_info,
              status, found_timestamp,
              (face_vector IS NOT NULL) AS face_enrolled
       FROM missing_persons
       WHERE status != 'INACTIVE'
       ORDER BY reported_date DESC`
    );
    return res.json({ success: true, persons: result.rows });
  } catch (error) {
    logger.error('getAllPersons failed:', error.message);
    return next(error);
  }
}

/**
 * POST /api/persons/register-missing-person  — spec-friendly alias
 */
export async function registerMissingPerson(req, res, next) {
  try {
    req.body.gender = req.body.gender ?? null;
    req.body.last_seen_location = req.body.last_seen_location ?? null;
    req.body.contact_info = req.body.contact_info ?? null;
    return await addPerson(req, res, next);
  } catch (error) {
    return next(error);
  }
}

export async function addPerson(req, res, next) {
  try {
    const { name, age, gender, description, last_seen_location, contact_info } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }

    const photo_path = req.file ? req.file.path.replace(/\\/g, '/') : null;

    // 1. Insert person record first
    const result = await pool.query(
      `INSERT INTO missing_persons
         (name, age, gender, description, last_seen_location, contact_info, photo_path, status, reported_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE', NOW())
       RETURNING id, name, age, gender, description, photo_path, status, reported_date,
                 last_seen_location, contact_info`,
      [name, age || null, gender || null, description || null,
        last_seen_location || null, contact_info || null, photo_path]
    );

    const person = result.rows[0];

    // 2. Run face enrollment — AWAITED so response reflects real result
    let faceEnrolled = false;
    let faceError = null;

    if (req.file) {
      logger.info(`Running face enrollment for person ${person.id} (${name})...`);
      const enrollResult = await runEnrollment(req.file.path);

      if (enrollResult.success && enrollResult.embedding) {
        try {
          await pool.query(
            `UPDATE missing_persons SET face_vector = $1 WHERE id = $2`,
            [JSON.stringify(enrollResult.embedding), person.id]
          );
          faceEnrolled = true;
          logger.info(`✅ Face enrolled for person ${person.id} (${name}) — ${enrollResult.embedding.length}-dim embedding`);
        } catch (dbErr) {
          faceError = `DB update failed: ${dbErr.message}`;
          logger.error(`Failed to save embedding for person ${person.id}: ${dbErr.message}`);
        }
      } else {
        faceError = enrollResult.error || 'No face detected in photo';
        logger.warn(`Face enrollment failed for person ${person.id}: ${faceError}`);
      }
    }

    return res.status(201).json({
      success: true,
      person: { ...person, face_enrolled: faceEnrolled },
      faceEnrolled,
      faceError: faceError || null,
      message: faceEnrolled
        ? `✅ Person registered and face enrolled (512-dim embedding stored)`
        : `Person registered${faceError ? ` (face error: ${faceError})` : ' (no photo provided)'}`,
    });
  } catch (error) {
    logger.error('addPerson failed:', error.message);
    return next(error);
  }
}

export async function updatePerson(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowed = ['ACTIVE', 'FOUND', 'INACTIVE', 'POSSIBLE_MATCH'];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${allowed.join(', ')}`,
      });
    }

    const extra = status === 'FOUND' ? ', found_timestamp = NOW()' : '';

    const result = await pool.query(
      `UPDATE missing_persons SET status = $1${extra} WHERE id = $2
       RETURNING id, name, age, gender, description, photo_path, status, reported_date,
                 last_seen_location, contact_info, found_timestamp,
                 (face_vector IS NOT NULL) AS face_enrolled`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Person not found' });
    }

    return res.json({ success: true, person: result.rows[0] });
  } catch (error) {
    logger.error('updatePerson failed:', error.message);
    return next(error);
  }
}

export async function deletePerson(req, res, next) {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "UPDATE missing_persons SET status = 'INACTIVE' WHERE id = $1 AND status != 'INACTIVE' RETURNING id",
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Person not found' });
    }

    return res.json({ success: true });
  } catch (error) {
    logger.error('deletePerson failed:', error.message);
    return next(error);
  }
}
