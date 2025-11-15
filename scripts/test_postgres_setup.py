import os
import sys
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

import psycopg2

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(PROJECT_ROOT))

from src.face_recognition.database import MissingPersonDB, PostgresConfig  # noqa: E402


def main():
    # Verify connection and PostGIS
    cfg = PostgresConfig()
    print(f"[INFO] Connecting to {cfg.host}:{cfg.port}/{cfg.dbname} as {cfg.user}")

    # Raw check for PostGIS
    raw = psycopg2.connect(
        host=cfg.host, port=cfg.port, dbname=cfg.dbname,
        user=cfg.user, password=cfg.password, sslmode=cfg.sslmode
    )
    try:
        with raw.cursor() as cur:
            cur.execute("SELECT PostGIS_Version();")
            version = cur.fetchone()[0]
            print(f"[OK] PostGIS version: {version}")
    finally:
        raw.close()

    # Use our DB class (creates tables/indexes if not exist)
    db = MissingPersonDB(cfg)

    try:
        # Health check
        assert db.health_check(), "Health check failed"
        print("[OK] Health check passed")

        # Create a sample person
        person_id = db.add_missing_person(
            name="Aayush Kulkarni",
            age=35,
            gender="Male",
            description="Height 5'90\", wearing blue jacket",
            photo_path="photos/aayush.jpg",
            last_seen_location="College Road",
            contact_info="8767248093",
            embedding=b"\x00\x01\x02"  # it is samplle emd
        )
        print(f"[OK] Inserted person id: {person_id}")

        # Log a sample detection
        detection_id = db.log_detection(
            person_id=person_id,
            location="College Road",
            confidence=0.92,
            crowd_density="MEDIUM",
            image_path="detections/sample.jpg",
            notes="Seen near fountain"
        )
        print(f"[OK] Inserted detection id: {detection_id}")

        # Log a sample alert
        alert_id = db.log_alert(
            alert_type="MISSING_PERSON",
            risk_level="WARNING",
            person_count=1,
            message="Potential match detected",
            location="College Road"
        )
        print(f"[OK] Inserted alert id: {alert_id}")

        # Statistics
        stats = db.get_statistics()
        print(f"[OK] Stats: {stats}")

    finally:
        db.close()


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"[ERROR] {e}", file=sys.stderr)
        sys.exit(1)


