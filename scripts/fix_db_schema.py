
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

def fix_schema():
    conn = psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", "5432"),
        dbname=os.getenv("DB_NAME", "missing_persons"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "")
    )
    cur = conn.cursor()
    try:
        print("Attempting to add found_timestamp column...")
        cur.execute("ALTER TABLE missing_persons ADD COLUMN IF NOT EXISTS found_timestamp TIMESTAMPTZ;")
        conn.commit()
        print("Success: Column added or already exists.")
    except Exception as e:
        conn.rollback()
        print(f"Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    fix_schema()
