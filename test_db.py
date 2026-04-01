from dotenv import load_dotenv
import os

load_dotenv()

try:
    from src.face_recognition.database import MissingPersonDB

    print("Testing PostgreSQL with your .env...")
    print(f" DB_USER: {os.getenv('DB_USER')}")
    print(f" DB_HOST: {os.getenv('DB_HOST')}")

    db = MissingPersonDB()
    if db.health_check():
        print("DATABASE PERFECT! Tables auto-created.")
        print("Stats:", db.get_statistics())
        print("\nNEXT: cd src\\face_recognition && python quick_demo.py")
    else:
        print("DB Connection failed - check PostgreSQL service")
    db.close()
except Exception as e:
    print(f"Import failed: {e}")
    print("Run: pip install -r requirements.txt")


