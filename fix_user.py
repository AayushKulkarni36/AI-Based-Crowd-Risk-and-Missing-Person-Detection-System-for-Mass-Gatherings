import psycopg2
import bcrypt
import sys

conn = psycopg2.connect(
    host="localhost",
    database="missing_persons",
    user="postgres",
    password="postgres123"
)
cursor = conn.cursor()

cursor.execute("DELETE FROM users WHERE email = 'admin@crowdnexis.ai'")
password_hash = bcrypt.hashpw(b'admin@123', bcrypt.gensalt(10)).decode('utf-8')
cursor.execute(
    "INSERT INTO users (email, password_hash, name, role, is_active) VALUES (%s, %s, %s, %s, %s)",
    ('admin@crowdnexis.ai', password_hash, 'Admin User', 'ADMIN', True)
)
conn.commit()
cursor.close()
conn.close()
print(f"[SUCCESS] User created with hash: {password_hash}")
