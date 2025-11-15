import path from 'path';
import { fileURLToPath } from 'url';

import { runYOLODetection } from '../utils/python.executor.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// In-memory job storage (consider persistent store for production)
const jobs = new Map();

export async function uploadVideo(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No video file provided' });
    }

    const videoId = Date.now().toString();
    const job = {
      id: videoId,
      filename: req.file.filename,
      path: req.file.path,
      status: 'uploaded',
      uploadedAt: new Date().toISOString()
    };

    jobs.set(videoId, job);

    return res.json({
      success: true,
      videoId,
      filename: req.file.filename,
      message: 'Video uploaded successfully'
    });
  } catch (error) {
    return next(error);
  }
}

export async function processVideo(req, res, next) {
  try {
    const { videoId } = req.params;
    const job = jobs.get(videoId);

    if (!job) {
      return res.status(404).json({ success: false, error: 'Video not found' });
    }

    if (job.status === 'processing') {
      return res.status(202).json({ success: true, message: 'Video already processing', videoId });
    }

    job.status = 'processing';
    job.processingStartedAt = new Date().toISOString();

    res.json({ success: true, message: 'Processing started', videoId });

    const outputPath = path.join(__dirname, '../../data/results', `result_${videoId}.avi`);

    try {
      const results = await runYOLODetection(job.path, outputPath);

      const avgPeople = Number(results.avgPeoplePerFrame || 0);
      const totalPeople = Number(results.totalPeople || 0);
      const totalFrames = Number(results.totalFrames || 0);
      const capacity = Number(process.env.CROWD_CAPACITY || 40);
      const occupancy = capacity > 0 ? (avgPeople / capacity) * 100 : 0;

      job.status = 'completed';
      job.completedAt = new Date().toISOString();
      job.results = {
        totalPeople,
        avgDensity: avgPeople,
        totalFrames,
        riskLevel: calculateRisk(occupancy),
        occupancy: occupancy.toFixed(1),
        processedVideo: `/results/result_${videoId}.avi`,
        suggestions: getSuggestions(occupancy)
      };
    } catch (error) {
      job.status = 'failed';
      job.error = error.message;
      job.failedAt = new Date().toISOString();
      console.error('Video processing failed:', error);
    }
  } catch (error) {
    next(error);
  }
}

export async function getResults(req, res, next) {
  try {
    const { videoId } = req.params;
    const job = jobs.get(videoId);

    if (!job) {
      return res.status(404).json({ success: false, error: 'Video not found' });
    }

    return res.json(job);
  } catch (error) {
    return next(error);
  }
}

function calculateRisk(occupancy) {
  if (occupancy < 80) return 'SAFE';
  if (occupancy < 95) return 'MODERATE';
  if (occupancy < 110) return 'RISKY';
  return 'CRITICAL';
}

function getSuggestions(occupancy) {
  const risk = calculateRisk(occupancy);
  const suggestions = {
    SAFE: ['✓ Occupancy is within safe limits', 'Continue regular monitoring'],
    MODERATE: ['⚠ Approaching maximum capacity', 'Monitor crowd flow closely', 'Prepare contingency measures'],
    RISKY: ['⚠⚠ Capacity limit reached', 'Stop allowing new entries', 'Consider relocating some people', 'Increase security presence'],
    CRITICAL: ['🚨 CRITICAL OVERCROWDING DETECTED', 'IMMEDIATE EVACUATION REQUIRED', 'Enable all emergency exits', 'Alert emergency services', 'Initiate crowd dispersal protocol']
  };
  return suggestions[risk] || suggestions.SAFE;
}
