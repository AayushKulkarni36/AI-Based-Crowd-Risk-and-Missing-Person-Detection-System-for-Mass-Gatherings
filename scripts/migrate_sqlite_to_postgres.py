import os
import sys
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(PROJECT_ROOT))

from src.face_recognition.database import MissingPersonDB, PostgresConfig  # noqa: E402


def main():
    sqlite_path = os.getenv("SQLITE_PATH", "data/missing_persons.db")
    cfg = PostgresConfig()
    db = MissingPersonDB(cfg)
    try:
        print(f"[INFO] Importing from SQLite: {sqlite_path}")
        counts = db.import_from_sqlite(sqlite_path)
        print(f"[DONE] Imported rows: {counts}")
    finally:
        db.close()


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"[ERROR] {e}", file=sys.stderr)
        sys.exit(1)


