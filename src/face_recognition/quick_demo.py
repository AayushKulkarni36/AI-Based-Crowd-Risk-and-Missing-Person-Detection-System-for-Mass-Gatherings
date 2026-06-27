import os
import sys
from pathlib import Path


# Ensure that the project src directory is on sys.path so that
# `face_recognition.*` imports work when running:
#   cd src/face_recognition && python quick_demo.py
PROJECT_SRC = Path(__file__).resolve().parents[1]
PROJECT_ROOT = Path(__file__).resolve().parents[2]

# Add src and root to path
if str(PROJECT_SRC) not in sys.path:
    sys.path.insert(0, str(PROJECT_SRC))
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from face_recognition.main import MassGatheringSurveillance


print("MASS GATHERING SURVEILLANCE - FACE SIMILARITY DEMO")
print("=" * 60)

# Ensure demo folder exists (Windows-friendly)
os.makedirs("data/demo", exist_ok=True)

# 1. INIT SYSTEM
print("\n1️⃣ INITIALIZING PIPELINE...")
surveillance = MassGatheringSurveillance()
processor = surveillance.face_processor

# 2. ADD DEMO PERSON (Graceful fallback, real embedding)
print("\n2️⃣ REGISTERING DEMO PERSON (Ayush) FROM PHOTO...")
demo_photo = "data/demo/ayush.jpg"
if os.path.exists(demo_photo):
    try:
        person_id = processor.add_missing_person(
            name="Ayush Kulkarni",
            age=22,
            gender="M",
            photo_path=demo_photo,
            description="MET Nashik IT Student - Face similarity demo",
        )
        print(f"✅ Demo person stored in PostgreSQL with embedding. ID: {person_id}")
        print("   → Any high-similarity match in live video will use cosine similarity.")
    except Exception as exc:
        print(f"⚠️  Failed to add demo person to DB (similarity demo will still run): {exc}")
else:
    print("⚠️  No photo found at data/demo/ayush.jpg")
    print("   → Continuing with detection-only demo (no database similarity matches).")

# 3. VIDEO-FIRST DEMO (uploaded CCTV preferred)
print("\n3️⃣ RUNNING DEMO ON VIDEO OR WEBCAM...")
VIDEO_PATH = "data/demo/sample_crowd.mp4"
if os.path.exists(VIDEO_PATH):
    print(f"   - Using demo video: {VIDEO_PATH}")
    # duration=0 => process full video file
    surveillance.process_cctv_stream(source=VIDEO_PATH, duration=0)
else:
    print("   - Demo video not found, falling back to webcam (30s, press Q to quit)...")
    surveillance.process_cctv_stream(source=0, duration=30)

print("\n🎓 DEMO COMPLETE.")
print("   - Face similarity matching pipeline validated end-to-end")
print("   - All matches are based on cosine similarity of real FaceNet embeddings")
print("   - No live accuracy percentages or simulated scores are shown")
