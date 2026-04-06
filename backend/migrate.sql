-- ============================================================================
-- CrowdSafe Database Migration
-- Creates all tables for the crowd risk detection system
-- ============================================================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    -- legacy: some parts of code used `name`, newer auth uses `full_name`
    name VARCHAR(255),
    full_name VARCHAR(255),
    role VARCHAR(20) NOT NULL DEFAULT 'OPERATOR' CHECK (role IN ('ADMIN', 'OPERATOR')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure columns exist even on already-created DBs
ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);

-- Camera locations table
CREATE TABLE IF NOT EXISTS camera_locations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    stream_url VARCHAR(512),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Video jobs table
CREATE TABLE IF NOT EXISTS video_jobs (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'UPLOADED' 
        CHECK (status IN ('UPLOADED', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED')),
    progress INTEGER DEFAULT 0,
    total_people INTEGER,
    avg_density DECIMAL(10, 2),
    risk_level VARCHAR(20) CHECK (risk_level IN ('SAFE', 'MODERATE', 'RISKY', 'CRITICAL', 'UNKNOWN')),
    face_matches_count INTEGER DEFAULT 0,
    heatmap_grid TEXT,
    results_json TEXT,
    error_message TEXT,
    uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    camera_id INTEGER REFERENCES camera_locations(id) ON DELETE SET NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processing_started_at TIMESTAMPTZ,
    processing_completed_at TIMESTAMPTZ
);

-- Missing persons table
CREATE TABLE IF NOT EXISTS missing_persons (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    age INTEGER,
    gender VARCHAR(20),
    description TEXT,
    last_seen_location VARCHAR(255),
    contact_info VARCHAR(255),
    photo_path VARCHAR(512),
    face_vector TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' 
        CHECK (status IN ('ACTIVE', 'FOUND', 'INACTIVE', 'POSSIBLE_MATCH')),
    reported_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    found_timestamp TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Alert logs table
CREATE TABLE IF NOT EXISTS alert_logs (
    id SERIAL PRIMARY KEY,
    video_job_id INTEGER REFERENCES video_jobs(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    alert_type TEXT,
    risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('SAFE', 'MODERATE', 'RISKY', 'CRITICAL')),
    person_count INTEGER,
    occupancy_percentage DECIMAL(5, 2),
    message TEXT,
    location TEXT,
    image_path VARCHAR(512),
    acknowledged BOOLEAN NOT NULL DEFAULT false,
    acknowledged_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Detections table
CREATE TABLE IF NOT EXISTS detections (
    id SERIAL PRIMARY KEY,
    person_id INTEGER REFERENCES missing_persons(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    frame_id INTEGER,
    similarity DECIMAL(5, 4),
    image_path VARCHAR(512)
);

-- Face matches table
CREATE TABLE IF NOT EXISTS face_matches (
    id SERIAL PRIMARY KEY,
    video_job_id INTEGER REFERENCES video_jobs(id) ON DELETE CASCADE,
    missing_person_id INTEGER REFERENCES missing_persons(id) ON DELETE CASCADE,
    confidence DECIMAL(5, 4),
    frame_number INTEGER,
    status VARCHAR(30) DEFAULT 'POSSIBLE_MATCH' 
        CHECK (status IN ('POSSIBLE_MATCH', 'CONFIRMED', 'FALSE_POSITIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_video_jobs_status ON video_jobs(status);
CREATE INDEX IF NOT EXISTS idx_video_jobs_uploaded_by ON video_jobs(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_missing_persons_status ON missing_persons(status);
CREATE INDEX IF NOT EXISTS idx_alert_logs_risk_level ON alert_logs(risk_level);
CREATE INDEX IF NOT EXISTS idx_alert_logs_created_at ON alert_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_detections_person_id ON detections(person_id);
CREATE INDEX IF NOT EXISTS idx_face_matches_video_job ON face_matches(video_job_id);
CREATE INDEX IF NOT EXISTS idx_face_matches_person ON face_matches(missing_person_id);
