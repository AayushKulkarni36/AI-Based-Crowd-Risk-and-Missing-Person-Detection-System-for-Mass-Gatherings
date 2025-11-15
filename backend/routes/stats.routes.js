import express from 'express';
import { getOverview, getAlerts } from '../controllers/stats.controller.js';

const router = express.Router();

router.get('/overview', getOverview);
router.get('/alerts', getAlerts);

export default router;
