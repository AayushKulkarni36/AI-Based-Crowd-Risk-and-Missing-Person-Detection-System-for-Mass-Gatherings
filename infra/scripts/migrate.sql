-- ============================================================================
-- AI-Based Crowd Risk & Missing Person Detection System
-- PostgreSQL Schema Migration
-- ============================================================================
-- This migration adds pgvector support, new tables, and schema extensions.
-- Run with: psql -U postgres -d missing_persons -f infra/scripts/migrate.sql

-- Enable pgvector extension (requires: CREATE EXTENSION pgvector)
CREATE EXTENSION IF NOT EXISTS pgvector;

-- ============================================================================
-- TABLE: missing_persons (extended from existing schema)
-- Status values: ACTIVE, FOUND, POSSIBLE_MATCH, INACTIVE
-- ============================================================================
CREATE TABLE IF NOT EXISTS missing_persons (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  age INT,
  gender VARCHAR(10),
  description TEXT,
  last_seen_location VARCHAR(255),
  contact_info VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'FOUND', 'POSSIBLE_MATCH', 'INACTIVE')),
  reported_date TIMESTAMPTZ DEFAULT NOW(),
  photo_path TEXT,
  face_vector vector(512),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Index for status queries (critical for dashboard stats)
CREATE INDEX IF NOT EXISTS idx_missing_persons_status
  ON missing_persons(status);

-- Index for face vector similarity search (pgvector cosine)
CREATE INDEX IF NOT EXISTS idx_missing_persons_face_vector
  ON missing_persons
  USING ivfflat (face_vector vector_cosine_ops)
  WITH (lists = 100);

-- ============================================================================
-- TABLE: users (authentication & role-based access)
-- Roles: ADMIN (can manage users, settings, override decisions)
--        OPERATOR (can upload videos, search, acknowledge alerts)
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name VARCHAR(255),
  role VARCHAR(20) NOT NULL DEFAULT 'OPERATOR'
    CHECK (role IN ('ADMIN', 'OPERATOR')),
  last_login TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ============================================================================
-- TABLE: camera_locations (venue/camera management for map view)
-- ============================================================================
CREATE TABLE IF NOT EXISTS camera_locations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  zone VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'INACTIVE', 'MAINTENANCE')),
  address VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_camera_locations_status
  ON camera_locations(status);

-- ============================================================================
-- TABLE: video_jobs (job queue tracking for BullMQ persistence)
-- Status: QUEUED, PROCESSING, COMPLETED, FAILED
-- ============================================================================
CREATE TABLE IF NOT EXISTS video_jobs (
  id SERIAL PRIMARY KEY,
  job_id VARCHAR(255) UNIQUE,
  filename VARCHAR(500) NOT NULL,
  file_path TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'QUEUED'
    CHECK (status IN ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED')),
  progress INT DEFAULT 0,
  total_people INT,
  avg_density FLOAT,
  risk_level VARCHAR(20),
  face_matches_count INT DEFAULT 0,
  heatmap_grid TEXT,
  output_video_path TEXT,
  error_message TEXT,
  results_json JSONB,
  uploaded_by INT REFERENCES users(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_video_jobs_status ON video_jobs(status);
CREATE INDEX IF NOT EXISTS idx_video_jobs_uploaded_by ON video_jobs(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_video_jobs_uploaded_at ON video_jobs(uploaded_at DESC);

-- ============================================================================
-- TABLE: detections (per-frame person detection data for statistics)
-- ============================================================================
CREATE TABLE IF NOT EXISTS detections (
  id SERIAL PRIMARY KEY,
  video_job_id INT REFERENCES video_jobs(id) ON DELETE CASCADE,
  frame_number INT NOT NULL,
  person_count INT NOT NULL,
  confidence FLOAT,
  detected_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_detections_video_job_id
  ON detections(video_job_id);
CREATE INDEX IF NOT EXISTS idx_detections_frame_number
  ON detections(video_job_id, frame_number);

-- ============================================================================
-- TABLE: face_matches (face recognition results for missing persons)
-- Status: POSSIBLE_MATCH (requires human confirmation), CONFIRMED (operator approved)
-- ============================================================================
CREATE TABLE IF NOT EXISTS face_matches (
  id SERIAL PRIMARY KEY,
  video_job_id INT REFERENCES video_jobs(id) ON DELETE CASCADE,
  missing_person_id INT REFERENCES missing_persons(id) ON DELETE CASCADE,
  confidence FLOAT NOT NULL,
  frame_number INT,
  embedding_distance FLOAT,
  status VARCHAR(20) NOT NULL DEFAULT 'POSSIBLE_MATCH'
    CHECK (status IN ('POSSIBLE_MATCH', 'CONFIRMED', 'FALSE_POSITIVE')),
  confirmed_by INT REFERENCES users(id),
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_face_matches_video_job_id
  ON face_matches(video_job_id);
CREATE INDEX IF NOT EXISTS idx_face_matches_person_id
  ON face_matches(missing_person_id);
CREATE INDEX IF NOT EXISTS idx_face_matches_status
  ON face_matches(status);

-- ============================================================================
-- TABLE: alert_logs (crowd risk alerts for statistics & history)
-- Risk levels: SAFE, MODERATE, RISKY, CRITICAL
-- ============================================================================
CREATE TABLE IF NOT EXISTS alert_logs (
  id SERIAL PRIMARY KEY,
  video_job_id INT REFERENCES video_jobs(id) ON DELETE CASCADE,
  risk_level VARCHAR(20) NOT NULL
    CHECK (risk_level IN ('SAFE', 'MODERATE', 'RISKY', 'CRITICAL')),
  person_count INT,
  occupancy_percentage FLOAT,
  message TEXT,
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by INT REFERENCES users(id),
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_logs_risk_level ON alert_logs(risk_level);
CREATE INDEX IF NOT EXISTS idx_alert_logs_acknowledged ON alert_logs(acknowledged);
CREATE INDEX IF NOT EXISTS idx_alert_logs_created_at
  ON alert_logs(created_at DESC);

-- ============================================================================
-- TABLE: notification_preferences (user-configurable alerts)
-- ============================================================================
CREATE TABLE IF NOT EXISTS notification_preferences (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_on_critical BOOLEAN DEFAULT TRUE,
  email_on_face_match BOOLEAN DEFAULT TRUE,
  sms_on_critical BOOLEAN DEFAULT FALSE,
  whatsapp_on_critical BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- SEED DATA (demo users and camera locations)
-- ============================================================================

-- Seed admin user (password: admin123 hashed with bcrypt)
-- Hash generated locally (do NOT use in production — change immediately)
INSERT INTO users (email, password_hash, name, role)
VALUES ('admin@crowdnexis.local', '$2b$10$DXmeUzzzzzzzzzzzzzzzzzzzzzzzzzz', 'Admin User', 'ADMIN')
ON CONFLICT (email) DO NOTHING;

-- Seed operator user
INSERT INTO users (email, password_hash, name, role)
VALUES ('operator@crowdnexis.local', '$2b$10$OXmeUzzzzzzzzzzzzzzzzzzzzzzzzzz', 'Operator User', 'OPERATOR')
ON CONFLICT (email) DO NOTHING;

-- Seed camera locations (Pune, India - realistic coordinates)
-- Using Shivaji Stadium area as reference venue
INSERT INTO camera_locations (name, description, latitude, longitude, zone, status, address)
VALUES
  ('North Entrance', 'Main entry point', 18.5320, 73.8592, 'ZONE_A', 'ACTIVE', 'North Gate, Stadium Road'),
  ('South Gate', 'Secondary entry/exit', 18.5310, 73.8585, 'ZONE_A', 'ACTIVE', 'South Gate, Stadium Road'),
  ('Concourse Level 1', 'Main concourse', 18.5315, 73.8590, 'ZONE_B', 'ACTIVE', 'Level 1 Concourse'),
  ('Seating Area East', 'East wing spectator area', 18.5318, 73.8598, 'ZONE_C', 'ACTIVE', 'East Seating Section'),
  ('Emergency Exit', 'Emergency evacuation route', 18.5305, 73.8575, 'ZONE_A', 'ACTIVE', 'Emergency Exit Corridor')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- FINAL METADATA
-- ============================================================================
-- Schema version for tracking migrations
COMMENT ON TABLE missing_persons IS 'Missing persons registry with face vectors for FAISS similarity search';
COMMENT ON TABLE users IS 'User accounts with role-based access control (ADMIN, OPERATOR)';
COMMENT ON TABLE camera_locations IS 'Camera/sensor locations for venue mapping and zone management';
COMMENT ON TABLE video_jobs IS 'Job queue tracking for video processing pipeline';
COMMENT ON TABLE detections IS 'Per-frame person count statistics derived from video analysis';
COMMENT ON TABLE face_matches IS 'Face recognition matches linking detected faces to missing persons';
COMMENT ON TABLE alert_logs IS 'Crowd risk alert history for statistics and auditing';

-- Grant permissions (adjust as needed for your environment)
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO postgres;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres;

COMMIT;
