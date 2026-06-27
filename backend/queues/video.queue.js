import { Queue } from 'bullmq';
import { redisConfig } from '../config/redis.js';

// Create video processing job queue
export const videoQueue = new Queue('video-processing', {
  connection: redisConfig,
  // Set to 1 because GPU can only run one job at a time
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: false, // Keep job history for logging
    removeOnFail: false
  }
});

// Queue event handlers
videoQueue.on('progress', (job, progress) => {
  console.log(`Job ${job.id} progress: ${progress}%`);
});

videoQueue.on('completed', (job) => {
  console.log(`✓ Job ${job.id} completed`);
});

videoQueue.on('failed', (job, err) => {
  console.error(`✗ Job ${job.id} failed: ${err.message}`);
});

videoQueue.on('error', (err) => {
  console.error('Queue error:', err);
});

export default videoQueue;
