import express from 'express';
import { getOverview, getAlerts, getDetectionsToday } from '../controllers/stats.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/overview', requireAuth, getOverview);
router.get('/alerts', requireAuth, getAlerts);
router.get('/detections-today', requireAuth, getDetectionsToday);

export default router;
