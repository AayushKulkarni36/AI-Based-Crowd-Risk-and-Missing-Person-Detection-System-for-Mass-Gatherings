"""
Missing Person Database Module
PostgreSQL (psycopg2) storage for missing persons registry
"""
import os
import logging
from pathlib import Path
from typing import Optional, List, Dict, Any

from contextlib import contextmanager
from dataclasses import dataclass

import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2.pool import SimpleConnectionPool

try:
    # Optional, for .env local development
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class PostgresConfig:
    host: str = os.getenv("DB_HOST", "localhost")
    port: int = int(os.getenv("DB_PORT", "5432"))
    dbname: str = os.getenv("DB_NAME", "missing_persons")
    user: str = os.getenv("DB_USER", "postgres")
    password: str = os.getenv("DB_PASSWORD", "")
    sslmode: str = os.getenv("DB_SSLMODE", "prefer")
    minconn: int = int(os.getenv("DB_MIN_CONN", "1"))
    maxconn: int = int(os.getenv("DB_MAX_CONN", "5"))

    def kwargs(self) -> Dict[str, Any]:
        return {
            "host": self.host,
            "port": self.port,
            "dbname": self.dbname,
            "user": self.user,
            "password": self.password,
            "sslmode": self.sslmode,
        }


class MissingPersonDB:
    """
    Database manager for missing persons registry on PostgreSQL.
    Uses connection pooling and returns dictionaries for rows.
    """

    def __init__(self, config: Optional[PostgresConfig] = None):
        """
        Initialize PostgreSQL connection pool and ensure schema exists.

        Args:
            config: Optional PostgresConfig (reads from env if omitted)
        """
        self.config = config or PostgresConfig()
        try:
            self.pool = SimpleConnectionPool(
                self.config.minconn,
                self.config.maxconn,
                cursor_factory=RealDictCursor,
                **self.config.kwargs(),
            )
        except Exception as exc:
            raise RuntimeError(f"Failed to initialize PostgreSQL pool: {exc}") from exc

        self._create_extensions()
        self._create_tables()
        self._create_indexes()
        logger.info("[INFO] PostgreSQL connection pool initialized")

    @contextmanager
    def _get_conn(self):
        """Context manager to get/put connections from the pool."""
        conn = None
        try:
            conn = self.pool.getconn()
            yield conn
        finally:
            if conn is not None:
                self.pool.putconn(conn)

    def _create_extensions(self):
        """Enable required extensions (PostGIS)."""
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                try:
                    cur.execute("CREATE EXTENSION IF NOT EXISTS postgis;")
                    conn.commit()
                except Exception as exc:
                    conn.rollback()
                    logger.warning(f"[WARN] Could not enable PostGIS: {exc}")

    def _create_tables(self):
        """Create database tables if they don't exist (PostgreSQL syntax)."""
        with self._get_conn() as conn:
            with conn.cursor() as cursor:
                # Missing persons table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS missing_persons (
                        id BIGSERIAL PRIMARY KEY,
                        name TEXT NOT NULL,
                        age INTEGER,
                        gender TEXT,
                        description TEXT,
                        photo_path TEXT,
                        embedding BYTEA,
                        reported_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                        last_seen_location TEXT,
                        contact_info TEXT,
                        status TEXT DEFAULT 'ACTIVE'
                    )
                ''')

                # Detections table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS detections (
                        id BIGSERIAL PRIMARY KEY,
                        person_id BIGINT REFERENCES missing_persons(id),
                        detection_timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                        location TEXT,
                        confidence DOUBLE PRECISION,
                        crowd_density TEXT,
                        image_path TEXT,
                        notes TEXT
                    )
                ''')

                # Alert logs table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS alert_logs (
                        id BIGSERIAL PRIMARY KEY,
                        timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                        alert_type TEXT,
                        risk_level TEXT,
                        person_count INTEGER,
                        message TEXT,
                        location TEXT
                    )
                ''')
                conn.commit()
                logger.info("[INFO] Database tables created/verified")

    def _create_indexes(self):
        """Create helpful indexes for frequent queries."""
        with self._get_conn() as conn:
            with conn.cursor() as cursor:
                try:
                    cursor.execute("CREATE INDEX IF NOT EXISTS idx_missing_persons_status ON missing_persons(status);")
                    cursor.execute("CREATE INDEX IF NOT EXISTS idx_detections_person_id ON detections(person_id);")
                    cursor.execute("CREATE INDEX IF NOT EXISTS idx_detections_timestamp ON detections(detection_timestamp);")
                    conn.commit()
                except Exception as exc:
                    conn.rollback()
                    logger.warning(f"[WARN] Failed to create indexes: {exc}")

    def add_missing_person(self, name: str, age: int, gender: str,
                           description: str, photo_path: str,
                           last_seen_location: Optional[str] = None,
                           contact_info: Optional[str] = None,
                           embedding: Optional[bytes] = None) -> int:
        """
        Add new missing person to database.

        Returns:
            ID of inserted record
        """
        with self._get_conn() as conn:
            with conn.cursor() as cursor:
                cursor.execute('''
                    INSERT INTO missing_persons 
                    (name, age, gender, description, photo_path, last_seen_location, contact_info, embedding)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                ''', (name, age, gender, description, photo_path, last_seen_location, contact_info, embedding))
                new_id = cursor.fetchone()["id"]
                conn.commit()
                logger.info(f"[INFO] Added missing person: {name} (ID: {new_id})")
                return int(new_id)

    def get_active_missing_persons(self) -> List[Dict[str, Any]]:
        """Get all active missing persons."""
        with self._get_conn() as conn:
            with conn.cursor() as cursor:
                cursor.execute('''
                    SELECT * FROM missing_persons WHERE status = 'ACTIVE'
                    ORDER BY reported_date DESC
                ''')
                rows = cursor.fetchall()
                return [dict(row) for row in rows]

    def log_detection(self, person_id: int, location: str,
                      confidence: float, crowd_density: str,
                      image_path: Optional[str] = None, notes: Optional[str] = None) -> int:
        """Log a detection event."""
        with self._get_conn() as conn:
            with conn.cursor() as cursor:
                cursor.execute('''
                    INSERT INTO detections 
                    (person_id, location, confidence, crowd_density, image_path, notes)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING id
                ''', (person_id, location, confidence, crowd_density, image_path, notes))
                new_id = cursor.fetchone()["id"]
                conn.commit()
                logger.info(f"[INFO] Logged detection for person ID: {person_id}")
                return int(new_id)

    def log_alert(self, alert_type: str, risk_level: str,
                  person_count: int, message: str, location: Optional[str] = None) -> int:
        """Log an alert event."""
        with self._get_conn() as conn:
            with conn.cursor() as cursor:
                cursor.execute('''
                    INSERT INTO alert_logs 
                    (alert_type, risk_level, person_count, message, location)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id
                ''', (alert_type, risk_level, person_count, message, location))
                new_id = cursor.fetchone()["id"]
                conn.commit()
                return int(new_id)

    def update_person_status(self, person_id: int, status: str) -> None:
        """Update missing person status (ACTIVE/FOUND/CLOSED)."""
        with self._get_conn() as conn:
            with conn.cursor() as cursor:
                cursor.execute('''
                    UPDATE missing_persons SET status = %s WHERE id = %s
                ''', (status, person_id))
                conn.commit()
                logger.info(f"[INFO] Updated person {person_id} status to: {status}")

    def get_statistics(self) -> Dict[str, Any]:
        """Get database statistics."""
        stats: Dict[str, Any] = {}
        with self._get_conn() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT COUNT(*) AS c FROM missing_persons WHERE status='ACTIVE'")
                stats['active_missing'] = int(cursor.fetchone()["c"])

                cursor.execute("SELECT COUNT(*) AS c FROM detections")
                stats['total_detections'] = int(cursor.fetchone()["c"])

                cursor.execute("SELECT COUNT(*) AS c FROM alert_logs")
                stats['total_alerts'] = int(cursor.fetchone()["c"])

                cursor.execute('''
                    SELECT risk_level, COUNT(*) AS count 
                    FROM alert_logs 
                    GROUP BY risk_level
                ''')
                stats['alerts_by_level'] = {row['risk_level']: row['count'] for row in cursor.fetchall()}
        return stats

    def health_check(self) -> bool:
        """Check connection health by running a simple query."""
        try:
            with self._get_conn() as conn:
                with conn.cursor() as cursor:
                    cursor.execute("SELECT 1;")
                    _ = cursor.fetchone()
            return True
        except Exception as exc:
            logger.error(f"[ERROR] Health check failed: {exc}")
            return False

    def import_from_sqlite(self, sqlite_path: str = "data/missing_persons.db") -> Dict[str, int]:
        """
        Import existing data from a SQLite file into PostgreSQL.
        Returns counts per table imported.
        """
        import sqlite3

        counts = {"missing_persons": 0, "detections": 0, "alert_logs": 0}
        if not Path(sqlite_path).exists():
            logger.info(f"[INFO] No SQLite file found at {sqlite_path}. Skipping import.")
            return counts

        sql_conn = sqlite3.connect(sqlite_path)
        sql_conn.row_factory = sqlite3.Row

        with self._get_conn() as pg_conn:
            with pg_conn.cursor() as cur:
                # missing_persons
                for row in sql_conn.execute("SELECT * FROM missing_persons"):
                    cur.execute('''
                        INSERT INTO missing_persons
                        (id, name, age, gender, description, photo_path, embedding, reported_date,
                         last_seen_location, contact_info, status)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (id) DO NOTHING
                    ''', (
                        row["id"],
                        row["name"],
                        row["age"],
                        row["gender"],
                        row["description"],
                        row["photo_path"],
                        row["embedding"],
                        row["reported_date"],
                        row["last_seen_location"],
                        row["contact_info"],
                        row["status"],
                    ))
                    counts["missing_persons"] += 1

                # detections
                for row in sql_conn.execute("SELECT * FROM detections"):
                    cur.execute('''
                        INSERT INTO detections
                        (id, person_id, detection_timestamp, location, confidence, crowd_density, image_path, notes)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (id) DO NOTHING
                    ''', (
                        row["id"],
                        row["person_id"],
                        row["detection_timestamp"],
                        row["location"],
                        row["confidence"],
                        row["crowd_density"],
                        row["image_path"],
                        row["notes"],
                    ))
                    counts["detections"] += 1

                # alert_logs
                for row in sql_conn.execute("SELECT * FROM alert_logs"):
                    cur.execute('''
                        INSERT INTO alert_logs
                        (id, timestamp, alert_type, risk_level, person_count, message, location)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (id) DO NOTHING
                    ''', (
                        row["id"],
                        row["timestamp"],
                        row["alert_type"],
                        row["risk_level"],
                        row["person_count"],
                        row["message"],
                        row["location"],
                    ))
                    counts["alert_logs"] += 1

                pg_conn.commit()

        sql_conn.close()
        logger.info(f"[INFO] Import complete: {counts}")
        return counts

    def export_to_sqlite(self, sqlite_path: str = "data/missing_persons_export.db") -> Dict[str, int]:
        """
        Export current PostgreSQL data to a new SQLite file (backup/portability).
        Returns counts per table exported.
        """
        import sqlite3

        Path(sqlite_path).parent.mkdir(parents=True, exist_ok=True)
        if Path(sqlite_path).exists():
            Path(sqlite_path).unlink()

        counts = {"missing_persons": 0, "detections": 0, "alert_logs": 0}
        sql_conn = sqlite3.connect(sqlite_path)
        try:
            cur = sql_conn.cursor()
            cur.execute('''
                CREATE TABLE missing_persons (
                    id INTEGER PRIMARY KEY,
                    name TEXT NOT NULL,
                    age INTEGER,
                    gender TEXT,
                    description TEXT,
                    photo_path TEXT,
                    embedding BLOB,
                    reported_date TEXT,
                    last_seen_location TEXT,
                    contact_info TEXT,
                    status TEXT
                )
            ''')
            cur.execute('''
                CREATE TABLE detections (
                    id INTEGER PRIMARY KEY,
                    person_id INTEGER,
                    detection_timestamp TEXT,
                    location TEXT,
                    confidence REAL,
                    crowd_density TEXT,
                    image_path TEXT,
                    notes TEXT
                )
            ''')
            cur.execute('''
                CREATE TABLE alert_logs (
                    id INTEGER PRIMARY KEY,
                    timestamp TEXT,
                    alert_type TEXT,
                    risk_level TEXT,
                    person_count INTEGER,
                    message TEXT,
                    location TEXT
                )
            ''')
            sql_conn.commit()

            with self._get_conn() as pg_conn:
                with pg_conn.cursor() as pg_cur:
                    # missing_persons
                    pg_cur.execute("SELECT * FROM missing_persons ORDER BY id;")
                    for row in pg_cur.fetchall():
                        cur.execute('''
                            INSERT INTO missing_persons
                            (id, name, age, gender, description, photo_path, embedding, reported_date,
                             last_seen_location, contact_info, status)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ''', (
                            row["id"], row["name"], row["age"], row["gender"], row["description"],
                            row["photo_path"], row["embedding"], str(row["reported_date"]),
                            row["last_seen_location"], row["contact_info"], row["status"]
                        ))
                        counts["missing_persons"] += 1

                    # detections
                    pg_cur.execute("SELECT * FROM detections ORDER BY id;")
                    for row in pg_cur.fetchall():
                        cur.execute('''
                            INSERT INTO detections
                            (id, person_id, detection_timestamp, location, confidence, crowd_density, image_path, notes)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        ''', (
                            row["id"], row["person_id"], str(row["detection_timestamp"]), row["location"],
                            row["confidence"], row["crowd_density"], row["image_path"], row["notes"]
                        ))
                        counts["detections"] += 1

                    # alert_logs
                    pg_cur.execute("SELECT * FROM alert_logs ORDER BY id;")
                    for row in pg_cur.fetchall():
                        cur.execute('''
                            INSERT INTO alert_logs
                            (id, timestamp, alert_type, risk_level, person_count, message, location)
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                        ''', (
                            row["id"], str(row["timestamp"]), row["alert_type"], row["risk_level"],
                            row["person_count"], row["message"], row["location"]
                        ))
                        counts["alert_logs"] += 1

            sql_conn.commit()
            logger.info(f"[INFO] Export complete: {counts} -> {sqlite_path}")
            return counts
        finally:
            sql_conn.close()

    def close(self):
        """Close the connection pool."""
        try:
            self.pool.closeall()
            logger.info("[INFO] PostgreSQL connections closed")
        except Exception:
            pass

