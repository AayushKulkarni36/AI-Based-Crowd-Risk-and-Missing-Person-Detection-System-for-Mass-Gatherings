import os
import sys
import psycopg2

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    print("Warning: python-dotenv not installed. Using environment variables directly.")

def create_database():
    """Create missing_persons database and enable PostGIS extension"""
    
    # Get database credentials from environment
    db_host = os.getenv('DB_HOST', 'localhost')
    db_port = os.getenv('DB_PORT', '5432')
    db_user = os.getenv('DB_USER', 'postgres')
    db_password = os.getenv('DB_PASSWORD')
    db_name = os.getenv('DB_NAME', 'missing_persons')
    
    if not db_password:
        print("ERROR: DB_PASSWORD not set in environment or .env file")
        sys.exit(1)
    
    print(f"[INFO] Connecting to PostgreSQL at {db_host}:{db_port} as user '{db_user}'...")
    
    try:
        # Connect to default 'postgres' database to create our database
        conn = psycopg2.connect(
            host=db_host,
            port=db_port,
            user=db_user,
            password=db_password,
            database='postgres'
        )
        conn.autocommit = True
        cursor = conn.cursor()
        
        # Check if database exists
        cursor.execute(f"SELECT 1 FROM pg_database WHERE datname = '{db_name}'")
        exists = cursor.fetchone()
        
        if exists:
            print(f"[INFO] Database '{db_name}' already exists")
        else:
            print(f"[INFO] Creating database '{db_name}'...")
            cursor.execute(f"CREATE DATABASE {db_name}")
            print(f"[SUCCESS] Database '{db_name}' created successfully")
        
        cursor.close()
        conn.close()
        
        # Connect to the new database to enable PostGIS
        print(f"[INFO] Connecting to '{db_name}' database...")
        conn = psycopg2.connect(
            host=db_host,
            port=db_port,
            user=db_user,
            password=db_password,
            database=db_name
        )
        cursor = conn.cursor()
        
        # Enable PostGIS extension
        print("[INFO] Enabling PostGIS extension...")
        cursor.execute("CREATE EXTENSION IF NOT EXISTS postgis")
        conn.commit()
        print("[SUCCESS] PostGIS extension enabled")
        
        # Verify PostGIS installation
        cursor.execute("SELECT PostGIS_Version();")
        version = cursor.fetchone()[0]
        print(f"[INFO] PostGIS version: {version}")
        
        cursor.close()
        conn.close()
        
        print("\n[SUCCESS] PostgreSQL database setup complete!")
        print(f"Database: {db_name}")
        print(f"Host: {db_host}:{db_port}")
        print("PostGIS: Enabled")
        
    except psycopg2.Error as e:
        print(f"[ERROR] PostgreSQL error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"[ERROR] Unexpected error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    create_database()
