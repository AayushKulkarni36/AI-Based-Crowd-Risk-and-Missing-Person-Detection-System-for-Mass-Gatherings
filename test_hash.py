import bcrypt

# The hash that was created
stored_hash = "$2b$10$D3ipOdaBXStRIws4D.x/oehk8cRY4L2PEcXIWHCkEKdwUH4kyduEe"
password = "admin@123"

# Test if password matches
result = bcrypt.checkpw(password.encode('utf-8'), stored_hash.encode('utf-8'))
print(f"Password 'admin@123' matches hash: {result}")

# Also test with the database
import psycopg2
conn = psycopg2.connect(
    host="localhost",
    database="missing_persons",
    user="postgres",
    password="postgres123"
)
cursor = conn.cursor()
cursor.execute("SELECT password_hash FROM users WHERE email = 'admin@crowdnexis.ai'")
row = cursor.fetchone()
if row:
    db_hash = row[0]
    print(f"Hash in DB: {db_hash}") 
    db_result = bcrypt.checkpw(password.encode('utf-8'), db_hash.encode('utf-8'))
    print(f"Password matches DB hash: {db_result}")
else:
    print("User not found")
cursor.close()
conn.close()
