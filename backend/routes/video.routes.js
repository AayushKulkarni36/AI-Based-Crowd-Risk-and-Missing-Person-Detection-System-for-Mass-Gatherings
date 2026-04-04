import express from 'express';
import { videoUpload } from '../middleware/upload.js';
import { uploadVideo, processVideo, getResults, listVideos } from '../controllers/video.controller.js';

const router = express.Router();

// POST /api/video/upload — multipart video file upload
router.post('/upload', videoUpload.single('video'), uploadVideo);

// POST /api/video/process/:videoId — enqueue video for analysis
router.post('/process/:videoId', processVideo);

// GET /api/video/results/:videoId — poll results
router.get('/results/:videoId', getResults);

// GET /api/video/list — list all video jobs
router.get('/list', listVideos);

export default router;
