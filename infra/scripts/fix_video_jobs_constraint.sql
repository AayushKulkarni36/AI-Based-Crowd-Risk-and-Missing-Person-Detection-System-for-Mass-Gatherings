-- Fix video_jobs status constraint
-- Current: allows QUEUED, PROCESSING, COMPLETED, FAILED
-- New: allows UPLOADED, QUEUED, PROCESSING, COMPLETED, FAILED
-- Reason: Backend needs UPLOADED status for initial upload

BEGIN;

-- Drop existing constraint
ALTER TABLE video_jobs DROP CONSTRAINT IF EXISTS video_jobs_status_chk;

-- Add new constraint with all required statuses
ALTER TABLE video_jobs ADD CONSTRAINT video_jobs_status_chk
  CHECK (status IN ('UPLOADED', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED'));

-- Update default to UPLOADED (not QUEUED)
ALTER TABLE video_jobs ALTER COLUMN status SET DEFAULT 'UPLOADED';

COMMIT;
