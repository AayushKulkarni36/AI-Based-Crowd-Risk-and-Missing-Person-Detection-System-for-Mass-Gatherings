-- ============================================================================
-- Seed Data for CrowdSafe Demo
-- ============================================================================
-- This file populates initial demo data for testing and demonstration.
-- Run after migrate.sql: psql -U postgres -d missing_persons -f infra/scripts/seed.sql

-- Keep existing admin/operator users and cameras from migrate.sql
-- This file is meant to be idempotent (safe to run multiple times)

-- ============================================================================
-- DEMO MISSING PERSONS (for face recognition testing)
-- Note: photo_path and face_vector will be populated during testing
-- ============================================================================
INSERT INTO missing_persons (name, age, gender, description, last_seen_location, contact_info, status, reported_date)
VALUES
  ('Raj Kumar', 35, 'M', 'Missing since Feb 5, 2025. Last seen wearing blue shirt and jeans. Height: 5ft 8in', 'Shivaji Stadium, Pune', '+91-9876543210', 'ACTIVE', NOW() - INTERVAL '10 days'),
  ('Priya Sharma', 28, 'F', 'Missing for 5 days. Long black hair, glasses. Height: 5ft 4in. Last carrying red backpack', 'Oswald area, Pune', '+91-8765432109', 'ACTIVE', NOW() - INTERVAL '5 days'),
  ('Arjun Patel', 42, 'M', 'Missing since Feb 1. Wearing formal attire. Height: 5ft 10in', 'Raja Bahadur Chowk, Pune', '+91-7654321098', 'ACTIVE', NOW() - INTERVAL '15 days'),
  ('Neha Gupta', 26, 'F', 'Missing 3 days. Wearing purple dupatta. Fair complexion. Height: 5ft 3in', 'Aundh, Pune', '+91-6543210987', 'POSSIBLE_MATCH', NOW() - INTERVAL '3 days'),
  ('Vikram Singh', 45, 'M', 'Missing 20 days. Beard, wearing brown jacket. Height: 5ft 11in', 'Camp area, Pune', '+91-5432109876', 'INACTIVE', NOW() - INTERVAL '20 days')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- DEMO VIDEO JOBS (for testing job queue and processing)
-- These show various states: COMPLETED, PROCESSING, FAILED
-- ============================================================================
INSERT INTO video_jobs (
  job_id, filename, file_path, status, progress,
  total_people, avg_density, risk_level, face_matches_count,
  output_video_path, uploaded_by, uploaded_at, processing_started_at, processing_completed_at
)
SELECT
  'job_' || TO_CHAR(NOW() - INTERVAL '2 days', 'YYYY_MM_DD_HH24_MI_SS'),
  'stadium_entrance_2025_02_02.mp4',
  '/data/uploads/stadium_entrance_2025_02_02.mp4',
  'COMPLETED',
  100,
  127,
  42.3,
  'RISKY',
  2,
  '/results/result_1738502400000.avi',
  users.id,
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '2 days' + INTERVAL '1 minute',
  NOW() - INTERVAL '2 days' + INTERVAL '2 minutes'
FROM users WHERE email = 'operator@crowdsafe.local'
ON CONFLICT DO NOTHING;

INSERT INTO video_jobs (
  job_id, filename, file_path, status, progress, uploaded_by, uploaded_at, processing_started_at
)
SELECT
  'job_' || TO_CHAR(NOW() - INTERVAL '1 hour', 'YYYY_MM_DD_HH24_MI_SS'),
  'concourse_live_current.mp4',
  '/data/uploads/concourse_live_current.mp4',
  'PROCESSING',
  65,
  users.id,
  NOW() - INTERVAL '1 hour',
  NOW() - INTERVAL '45 minutes'
FROM users WHERE email = 'operator@crowdsafe.local'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- DEMO DETECTIONS (per-frame stats for completed job)
-- This shows crowd density over frames
-- ============================================================================
INSERT INTO detections (video_job_id, frame_number, person_count, confidence, detected_at)
SELECT
  video_jobs.id,
  frame_data.frame_num,
  frame_data.people_count,
  frame_data.conf,
  NOW() - INTERVAL '2 days' + (frame_data.frame_num * INTERVAL '33.33 milliseconds')
FROM video_jobs
CROSS JOIN LATERAL (
  VALUES
    (0, 12, 0.92),
    (30, 18, 0.94),
    (60, 25, 0.91),
    (90, 34, 0.89),
    (120, 42, 0.87),
    (150, 48, 0.85),
    (180, 55, 0.86),
    (210, 61, 0.88),
    (240, 67, 0.87),
    (270, 72, 0.85),
    (300, 78, 0.84),
    (330, 85, 0.83),
    (360, 91, 0.81),
    (390, 98, 0.80),
    (420, 102, 0.78),
    (450, 107, 0.76),
    (480, 112, 0.75),
    (510, 118, 0.73),
    (540, 125, 0.71),
    (570, 127, 0.70)
) AS frame_data(frame_num, people_count, conf)
WHERE video_jobs.status = 'COMPLETED'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- DEMO ALERT LOGS (risk level history)
-- ============================================================================
INSERT INTO alert_logs (video_job_id, risk_level, person_count, occupancy_percentage, message, acknowledged, created_at)
SELECT
  video_jobs.id,
  CASE
    WHEN person_count < 10 THEN 'SAFE'
    WHEN person_count < 25 THEN 'MODERATE'
    WHEN person_count < 50 THEN 'RISKY'
    ELSE 'CRITICAL'
  END,
  person_count,
  ROUND((person_count::FLOAT / 40 * 100)::NUMERIC, 2),
  'Crowd density alert from video processing',
  CASE WHEN person_count < 60 THEN TRUE ELSE FALSE END,
  NOW() - INTERVAL '2 days'
FROM (
  SELECT DISTINCT video_jobs.id, 127 as person_count
  FROM video_jobs
  WHERE video_jobs.status = 'COMPLETED'
) AS job_summary
ON CONFLICT DO NOTHING;

-- ============================================================================
-- DEMO FACE MATCHES (face recognition results)
-- ============================================================================
INSERT INTO face_matches (video_job_id, missing_person_id, confidence, frame_number, status, created_at)
SELECT
  vj.id,
  mp.id,
  0.72,
  125,
  'POSSIBLE_MATCH',
  NOW() - INTERVAL '2 days' + INTERVAL '4 minutes'
FROM video_jobs vj
CROSS JOIN missing_persons mp
WHERE vj.status = 'COMPLETED'
  AND mp.name = 'Raj Kumar'
  AND NOT EXISTS (
    SELECT 1 FROM face_matches
    WHERE video_job_id = vj.id AND missing_person_id = mp.id
  )
LIMIT 1;

-- ============================================================================
-- METADATA & FINAL CHECKS
-- ============================================================================
-- Verify schema creation
SELECT
  'Tables created: ' || COUNT(*) as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name IN (
    'missing_persons', 'users', 'camera_locations', 'video_jobs',
    'detections', 'face_matches', 'alert_logs', 'notification_preferences'
  );

-- Display seeded data count
SELECT
  'Seed data loaded: ' ||
  (SELECT COUNT(*) FROM users) || ' users, ' ||
  (SELECT COUNT(*) FROM missing_persons) || ' persons, ' ||
  (SELECT COUNT(*) FROM camera_locations) || ' cameras'
  as summary;

COMMIT;
