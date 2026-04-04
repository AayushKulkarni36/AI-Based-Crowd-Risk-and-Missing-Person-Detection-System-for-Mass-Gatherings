-- ============================================================================
-- CrowdSafe Database Seed Data
-- ============================================================================

-- Admin user (password: admin@123)
-- bcrypt hash for 'admin@123' with 10 rounds
INSERT INTO users (email, password_hash, name, role, is_active)
VALUES (
    'admin@crowdsafe.com',
    '$2b$10$YRqHIkLDerK19KSgz6zQGOmESnXrNx4VZSokhrmVgBSGE9bNIIkGy',
    'Admin User',
    'ADMIN',
    true
) ON CONFLICT (email) DO NOTHING;

-- Sample camera locations
INSERT INTO camera_locations (name, location, is_active) VALUES
('Camera 1 - Main Gate', 'Pune Station Main Entrance', true),
('Camera 2 - Platform 1', 'Pune Station Platform 1', true),
('Camera 3 - Mall Entrance', 'Phoenix Mall Main Gate', true)
ON CONFLICT DO NOTHING;
