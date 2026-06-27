-- ============================================================================
-- Add Face Matching Schema Extensions
-- Missing columns for proper face enrollment and matching
-- ============================================================================

BEGIN;

-- 1. Add missing columns to missing_persons table
ALTER TABLE missing_persons
  ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(50) DEFAULT 'facenet',
  ADD COLUMN IF NOT EXISTS embedding_created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS found_timestamp TIMESTAMPTZ;

-- 2. Drop old face_vector constraint/index if exists and recreate with proper settings
DROP INDEX IF EXISTS idx_missing_persons_face_vector;

-- Create new ivfflat index for fast similarity search
CREATE INDEX IF NOT EXISTS idx_missing_persons_face_vector
  ON missing_persons
  USING ivfflat (face_vector vector_cosine_ops)
  WITH (lists = 100);

-- 3. Create face_matches table if not exists
CREATE TABLE IF NOT EXISTS face_matches (
  id SERIAL PRIMARY KEY,
  person_id INT REFERENCES missing_persons(id) ON DELETE CASCADE,
  job_id INT REFERENCES video_jobs(id) ON DELETE CASCADE,
  frame_number INT,
  confidence FLOAT CHECK (confidence BETWEEN 0 AND 1),
  bbox_x INT,
  bbox_y INT,
  bbox_w INT,
  bbox_h INT,
  matched_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed BOOLEAN DEFAULT FALSE,
  confirmed_by VARCHAR(100),
  confirmed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_face_matches_person
  ON face_matches(person_id);
CREATE INDEX IF NOT EXISTS idx_face_matches_job
  ON face_matches(job_id);
CREATE INDEX IF NOT EXISTS idx_face_matches_matched_at
  ON face_matches(matched_at DESC);

-- 4. Update video_jobs status constraint to include UPLOADED
ALTER TABLE video_jobs
  DROP CONSTRAINT IF EXISTS video_jobs_status_chk;
ALTER TABLE video_jobs
  ADD CONSTRAINT video_jobs_status_chk
  CHECK (status IN ('UPLOADED', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED'));

-- 5. Add columns to track video_jobs more precisely
ALTER TABLE video_jobs
  ADD COLUMN IF NOT EXISTS uploaded_by INT REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS processing_completed_at TIMESTAMPTZ;

COMMIT;
