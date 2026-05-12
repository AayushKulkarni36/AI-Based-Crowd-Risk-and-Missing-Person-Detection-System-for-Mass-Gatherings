-- ============================================================================
-- Auto State Transition Migration
-- Adds fields to support automatic person status updates from video pipeline
-- ============================================================================

-- 1. Add matched_frame_id to missing_persons (if not exists)
ALTER TABLE missing_persons 
ADD COLUMN IF NOT EXISTS matched_frame_id TEXT;

-- 2. Add confirmed fields to face_matches (track manual confirmation)
ALTER TABLE face_matches 
ADD COLUMN IF NOT EXISTS confirmed BOOLEAN DEFAULT false;

ALTER TABLE face_matches 
ADD COLUMN IF NOT EXISTS confirmed_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE face_matches 
ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

-- 3. Fix column name inconsistency in face_matches
-- The table has 'video_job_id' but code uses 'job_id'
-- Add job_id as alias (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='face_matches' AND column_name='job_id') THEN
        ALTER TABLE face_matches ADD COLUMN job_id INTEGER;
        
        -- Copy existing data from video_job_id to job_id
        UPDATE face_matches SET job_id = video_job_id WHERE job_id IS NULL;
        
        -- Add foreign key constraint
        ALTER TABLE face_matches 
        ADD CONSTRAINT fk_face_matches_job 
        FOREIGN KEY (job_id) REFERENCES video_jobs(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 4. Fix column name inconsistency for person_id
-- The table has 'missing_person_id' but code uses 'person_id'
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='face_matches' AND column_name='person_id') THEN
        ALTER TABLE face_matches ADD COLUMN person_id INTEGER;
        
        -- Copy existing data
        UPDATE face_matches SET person_id = missing_person_id WHERE person_id IS NULL;
        
        -- Add foreign key constraint
        ALTER TABLE face_matches 
        ADD CONSTRAINT fk_face_matches_person 
        FOREIGN KEY (person_id) REFERENCES missing_persons(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 5. Update indexes for new columns
CREATE INDEX IF NOT EXISTS idx_face_matches_person_id ON face_matches(person_id);
CREATE INDEX IF NOT EXISTS idx_face_matches_job_id ON face_matches(job_id);
CREATE INDEX IF NOT EXISTS idx_face_matches_confirmed ON face_matches(confirmed);
CREATE INDEX IF NOT EXISTS idx_missing_persons_matched_frame ON missing_persons(matched_frame_id);

-- 6. Add trigger to auto-update found_timestamp when status changes to FOUND
CREATE OR REPLACE FUNCTION update_found_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'FOUND' AND OLD.status != 'FOUND' THEN
        NEW.found_timestamp = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_found_timestamp ON missing_persons;
CREATE TRIGGER trg_update_found_timestamp
    BEFORE UPDATE ON missing_persons
    FOR EACH ROW
    WHEN (NEW.status = 'FOUND' AND OLD.status IS DISTINCT FROM 'FOUND')
    EXECUTE FUNCTION update_found_timestamp();

-- 7. Add last_matched_at column to track when person was last detected
ALTER TABLE missing_persons 
ADD COLUMN IF NOT EXISTS last_matched_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_missing_persons_last_matched ON missing_persons(last_matched_at);

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Auto state transition migration completed successfully';
END $$;
