import bcrypt from 'bcrypt';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'missing_persons',
  user: 'postgres',
  password: 'postgres'
});

async function seed() {
  const hash = await bcrypt.hash('admin@123', 10);
  // Insert admin user
  const r1 = await pool.query(
    `INSERT INTO users (email, password_hash, name, full_name, role, is_active)
     VALUES ($1, $2, 'Admin User', 'Admin User', 'ADMIN', true)
     ON CONFLICT (email) DO NOTHING`,
    ['admin@crowdsafe.com', hash]
  );
  console.log('Admin user seeded:', r1.rowCount, 'row(s) inserted');

  // Insert sample camera locations
  const r2 = await pool.query(
    `INSERT INTO camera_locations (name, location, is_active)
     VALUES
       ('Camera 1 - Main Gate', 'Pune Station Entrance', true),
       ('Camera 2 - Platform 1', 'Pune Station Platform 1', true),
       ('Camera 3 - Mall Entrance', 'Phoenix Mall Gate', true)
     ON CONFLICT DO NOTHING`
  );
  console.log('Camera locations seeded:', r2.rowCount, 'row(s) inserted');

  await pool.end();
  console.log('Seeding complete.');
}

seed().catch(e => { console.error('Seed error:', e.message); process.exit(1); });
