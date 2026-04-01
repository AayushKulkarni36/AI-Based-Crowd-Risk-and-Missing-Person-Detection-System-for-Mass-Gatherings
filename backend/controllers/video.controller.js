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
      const averageFPS = parseFloat(results.averageFPS ?? 0) || 0;
      const minFPS = parseFloat(results.minFPS ?? 0) || 0;
      const maxFPS = parseFloat(results.maxFPS ?? 0) || 0;
      const fpsRating = results.fpsRating || 'N/A';

      job.status = 'completed';
      job.completedAt = new Date().toISOString();
      job.results = {
        totalPeople,
        avgDensity: avgPeople,
        totalFrames,
        riskLevel: calculateRisk(occupancy),
        occupancy: occupancy.toFixed(1),
        processedVideo: `/results/result_${videoId}.avi`,
        suggestions: getSuggestions(occupancy),
        averageFPS,
        minFPS,
        maxFPS,
        fpsRating
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

    if (job.status === 'completed' && job.results) {
      console.log('=== BACKEND: Sending to Frontend ===');
      console.log('Job Status:', job.status);
      console.log('Full Results Object:', job.results);
      console.log('FPS Values:', {
        averageFPS: job.results.averageFPS,
        minFPS: job.results.minFPS,
        maxFPS: job.results.maxFPS,
        fpsRating: job.results.fpsRating
      });
      console.log('Data Types:', {
        averageFPS: typeof job.results.averageFPS,
        minFPS: typeof job.results.minFPS,
        maxFPS: typeof job.results.maxFPS
      });
    }

    if (job.status === 'completed' && job.results) {
      return res.json({
        status: job.status,
        results: {
          totalPeople: job.results.totalPeople,
          avgPeoplePerFrame: job.results.avgDensity,
          totalFrames: job.results.totalFrames,
          maxPeople: job.results.totalPeople,
          riskLevel: job.results.riskLevel,
          averageFPS: job.results.averageFPS,
          minFPS: job.results.minFPS,
          maxFPS: job.results.maxFPS,
          fpsRating: job.results.fpsRating,
          processedVideo: job.results.processedVideo,
          suggestions: job.results.suggestions,
          occupancy: job.results.occupancy
        }
      });
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
