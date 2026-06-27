import express from 'express';
import { videoUpload } from '../middleware/upload.js';
import { uploadVideo, processVideo, getResults, listVideos } from '../controllers/video.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// POST /api/video/upload — multipart video file upload
router.post('/upload', requireAuth, videoUpload.single('video'), uploadVideo);

// POST /api/video/process/:videoId — enqueue video for analysis
router.post('/process/:videoId', requireAuth, processVideo);

// GET /api/video/results/:videoId — poll results
router.get('/results/:videoId', requireAuth, getResults);

// GET /api/video/list — list all video jobs
router.get('/list', requireAuth, listVideos);

export default router;
