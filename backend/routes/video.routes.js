import express from 'express';
import upload from '../middleware/upload.js';
import { uploadVideo, processVideo, getResults } from '../controllers/video.controller.js';

const router = express.Router();

router.post('/upload', upload.single('video'), uploadVideo);
router.post('/process/:videoId', processVideo);
router.get('/results/:videoId', getResults);

export default router;
