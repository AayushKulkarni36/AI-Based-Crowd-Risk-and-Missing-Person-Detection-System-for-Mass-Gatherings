import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import pool from '../config/db.js';
import logger from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FACE_API_URL = process.env.PYTHON_API_URL || 'http://localhost:8001';

export async function getAllPersons(_req, res, next) {
  try {
    // Real columns: id, name, age, gender, description, photo_path, embedding,
    //               reported_date, last_seen_location, contact_info, status, found_timestamp
    const result = await pool.query(
      `SELECT id, name, age, gender, description, photo_path,
              reported_date, last_seen_location, contact_info,
              status, found_timestamp
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

export async function addPerson(req, res, next) {
  try {
    const { name, age, gender, description, last_seen_location, contact_info } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }

    // photo_path from multer if file uploaded
    const photo_path = req.file ? req.file.path.replace(/\\/g, '/') : null;

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

    // Attempt face enrollment — non-blocking, failure is OK
    let faceEnrolled = false;
    let faceError = null;
    if (req.file) {
      try {
        const { spawn } = await import('child_process');
        const nodePath = (await import('path')).default;
        const pythonPath = process.env.PYTHON_PATH || nodePath.join(__dirname, '../../venv/Scripts/python.exe');
        const enrollScript = nodePath.join(__dirname, '../../src/face_recognition/enroll.py');

        let enrollOutput = '';
        let enrollError = '';

        const enrollProc = spawn(pythonPath, [enrollScript, '--image', req.file.path]);

        enrollProc.stdout.on('data', (data) => {
          enrollOutput += data.toString();
        });

        enrollProc.stderr.on('data', (data) => {
          enrollError += data.toString();
        });

        enrollProc.on('close', async (code) => {
          if (code === 0 && enrollOutput) {
            try {
              const enrollData = JSON.parse(enrollOutput.trim());
              if (enrollData.success && enrollData.embedding) {
                // Store embedding (as array of floats) in DB using pgvector
                const embeddingArray = enrollData.embedding;
                await pool.query(
                  `UPDATE missing_persons
                   SET face_vector = $1::vector,
                       embedding_model = 'facenet',
                       embedding_created_at = NOW()
                   WHERE id = $2`,
                  [JSON.stringify(embeddingArray), person.id]
                );
                faceEnrolled = true;
                logger.info(`Face enrolled for person ${person.id}`);
              } else if (!enrollData.success) {
                faceError = enrollData.error || 'No face detected in image';
                logger.warn(`Face enrollment skipped for person ${person.id}: ${faceError}`);
              }
            } catch (parseErr) {
              logger.warn(`Failed to parse face enrollment output: ${parseErr.message}`);
              faceError = 'Failed to process face enrollment';
            }
          } else if (code !== 0) {
            faceError = `Python error: ${enrollError.slice(-200)}`;
            logger.warn(`Face enrollment process failed: ${faceError}`);
          }
        });

        enrollProc.on('error', (err) => {
          faceError = `Failed to spawn enroll process: ${err.message}`;
          logger.warn(faceError);
        });
      } catch (faceErr) {
        faceError = faceErr.message;
        logger.warn(`Face enrollment failed for person ${person.id}: ${faceErr.message}`);
      }
    }

    return res.status(201).json({
      success: true,
      person,
      faceEnrolled,
      faceError: faceError || null,
      message: faceEnrolled
        ? 'Person registered and face enrolled'
        : `Person registered ${faceError ? `(face error: ${faceError})` : '(face enrollment skipped)'}`
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
      return res.status(400).json({ success: false, error: `Invalid status. Must be one of: ${allowed.join(', ')}` });
    }

    const extra = status === 'FOUND' ? ', found_timestamp = NOW()' : '';

    const result = await pool.query(
      `UPDATE missing_persons SET status = $1${extra} WHERE id = $2
       RETURNING id, name, age, gender, description, photo_path, status, reported_date,
                 last_seen_location, contact_info, found_timestamp`,
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
    // Soft delete: set status = INACTIVE
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
