import express from 'express';
import { requireAdmin } from '../middleware/auth.js';
import {
  runFaceMatch,
  getMatchResults,
  confirmMatch,
  dismissMatch
} from '../controllers/facematch.controller.js';

const router = express.Router();

// POST /api/facematch/run — start face matching on a completed video job
router.post('/run', requireAdmin, runFaceMatch);

// GET /api/facematch/:jobId — get face matching results for a job
router.get('/:jobId', requireAdmin, getMatchResults);

// PUT /api/facematch/:matchId/confirm — confirm a face match as genuine
router.put('/:matchId/confirm', requireAdmin, confirmMatch);

// DELETE /api/facematch/:matchId — dismiss a false positive match
router.delete('/:matchId', requireAdmin, dismissMatch);

export default router;
