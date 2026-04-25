import psycopg2
import bcrypt

# Seed admin user with correct password hash
conn = psycopg2.connect(
    host="localhost",
    database="missing_persons",
    user="postgres",
    password="postgres123"
)
cursor = conn.cursor()

# First, ensure the schema has all required columns
try:
    cursor.execute("""
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS full_name VARCHAR(255),
        ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()
    """)
    print("[OK] Schema migration completed")
except Exception as e:
    print(f"[!] Schema migration warning: {e}")

conn.commit()

# Generate hash for admin@123
password_hash = bcrypt.hashpw(b'admin@123', bcrypt.gensalt(12)).decode('utf-8')

# Delete any existing admin user
cursor.execute("DELETE FROM users WHERE email = 'admin@crowdnexis.ai';")

# Insert new admin user
cursor.execute("""
    INSERT INTO users (email, password_hash, full_name, role, is_active, created_at)
    VALUES (%s, %s, %s, 'ADMIN', true, NOW())
""", ('admin@crowdnexis.ai', password_hash, 'System Administrator'))

# Also seed an operator user for testing
operator_hash = bcrypt.hashpw(b'operator@123', bcrypt.gensalt(12)).decode('utf-8')
cursor.execute("DELETE FROM users WHERE email = 'operator@crowdnexis.ai';")
cursor.execute("""
    INSERT INTO users (email, password_hash, full_name, role, is_active, created_at)
    VALUES (%s, %s, %s, 'OPERATOR', true, NOW())
""", ('operator@crowdnexis.ai', operator_hash, 'Test Operator'))

conn.commit()

# Verify users
cursor.execute("SELECT email, role, full_name FROM users ORDER BY role;")
users = cursor.fetchall()

print("\n[USERS SEEDED SUCCESSFULLY]\n")
for email, role, full_name in users:
    print(f"  {email:30} | {role:8} | {full_name}")

print("\n[LOGIN CREDENTIALS]\n")
print("  Admin Account:")
print("    Email:    admin@crowdnexis.ai")
print("    Password: admin@123")
print("\n  Operator Account:")
print("    Email:    operator@crowdnexis.ai")
print("    Password: operator@123\n")

cursor.close()
conn.close()
