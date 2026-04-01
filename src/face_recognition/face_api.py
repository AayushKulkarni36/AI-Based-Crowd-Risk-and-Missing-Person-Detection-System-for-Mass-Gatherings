import os
import uuid
import sys
import json
import threading
from pathlib import Path

SRC_DIR = Path(__file__).resolve().parents[1]
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

import logging
import traceback

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

from flask import Flask, request, jsonify, send_from_directory, render_template
from flask_cors import CORS

from face_recognition.face_processor import FaceProcessor
from face_recognition.main import MassGatheringSurveillance


"""
Flask backend for face similarity matching and video processing.

Endpoints:
- POST /register_missing_person
- POST /upload_video
- GET  /processed/<video_id>

All operations use:
- MTCNN for face detection/alignment
- FaceNet (InceptionResnetV1, vggface2) embeddings
- Cosine similarity against PostgreSQL embeddings

This service demonstrates end-to-end face similarity matching and
pipeline validation; it does not report live accuracy metrics.
"""


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR.parent.parent / "data"
UPLOAD_DIR = DATA_DIR / "uploads"
PROCESSED_DIR = DATA_DIR / "processed"
PHOTO_DIR = DATA_DIR / "photos"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
PHOTO_DIR.mkdir(parents=True, exist_ok=True)

app = Flask(
    __name__,
    template_folder=str(BASE_DIR / "templates"),
    static_folder=str(BASE_DIR / "static"),
)
CORS(app)

# Reuse long-lived processor to avoid reloading models
face_processor = FaceProcessor()


def process_video_async(input_path: Path, output_path: Path, video_id: str) -> None:
    """
    Run the full MassGatheringSurveillance pipeline on a CCTV video
    in a background thread to avoid blocking the Flask request.
    Handles exceptions to ensure job state is updated (completed/failed).
    """
    logger.info(f"🚀 [Job {video_id}] Starting video processing...")
    logger.info(f"   Input: {input_path}")
    logger.info(f"   Output: {output_path}")

    done_flag = Path(str(output_path) + ".done")
    failed_flag = Path(str(output_path) + ".failed")

    try:
        mgs = MassGatheringSurveillance()
        mgs.process_cctv_stream(
            source=str(input_path),
            duration=0,
            output_path=str(output_path),
            show_window=False,
        )

        # Signal that video is fully written and ready to be served
        logger.info(f"✅ [Job {video_id}] Processing complete. Creating .done flag.")
        done_flag.touch()

    except Exception as e:
        logger.error(f"❌ [Job {video_id}] Processing FAILED: {e}")
        traceback.print_exc()
        
        # Write failure reason to file so frontend can know
        with open(failed_flag, "w") as f:
            f.write(str(e))
        
        # Ensure we don't leave a partial done flag if it somehow existed
        if done_flag.exists():
            done_flag.unlink()


@app.route("/")
def index():
    return render_template("index.html")


@app.post("/register_missing_person")
def register_missing_person():
    """
    Register a missing person using a real face photo.

    Expected form fields:
    - name (str)
    - age (int)
    - gender (str)
    - description (optional)
    - photo (file)
    """
    try:
        name = request.form.get("name", "").strip()
        age = int(request.form.get("age", "0"))
        gender = request.form.get("gender", "").strip()
        description = request.form.get("description", "").strip()
        photo_file = request.files.get("photo")

        if not name or not photo_file:
            return jsonify({"success": False, "error": "Name and photo are required."}), 400

        # Save photo to disk
        safe_name = name.replace(" ", "_")
        filename = f"{safe_name}_{uuid.uuid4().hex[:8]}.jpg"
        photo_path = PHOTO_DIR / filename
        photo_file.save(str(photo_path))

        # Use FaceProcessor to add person with real embedding
        person_id = face_processor.add_missing_person(
            name=name,
            age=age,
            gender=gender,
            photo_path=str(photo_path),
            description=description,
        )

        return jsonify(
            {
                "success": True,
                "person_id": person_id,
                "message": "Missing person registered with face similarity embedding.",
            }
        )
    except Exception as exc:
        logger.error(f"Error registering person: {exc}")
        return jsonify({"success": False, "error": str(exc)}), 500


@app.post("/upload_video")
def upload_video():
    """
    Upload a CCTV video and process it through the full
    crowd + face similarity + risk pipeline.
    """
    try:
        video_file = request.files.get("video")
        if not video_file:
            return jsonify({"success": False, "error": "No video file provided."}), 400

        video_id = uuid.uuid4().hex
        input_name = f"{video_id}_input.mp4"
        output_name = f"{video_id}_processed.mp4"
        input_path = UPLOAD_DIR / input_name
        output_path = PROCESSED_DIR / output_name

        video_file.save(str(input_path))
        logger.info(f"Received video upload: {video_id} ({input_path})")

        # Start background processing so the HTTP request returns immediately
        thread = threading.Thread(
            target=process_video_async,
            args=(input_path, output_path, video_id),
            daemon=True,
        )
        thread.start()

        return jsonify(
            {
                "success": True,
                "video_id": video_id,
                "processed_url": f"/processed/{video_id}",
                "message": "Video processing started. Please wait while analysis completes.",
            }
        )
    except Exception as exc:
        logger.error(f"Error starting video job: {exc}")
        return jsonify({"success": False, "error": str(exc)}), 500


@app.get("/processed/<video_id>")
def get_processed_video(video_id: str):
    """
    Serve processed video by ID.
    """
    prefix = f"{video_id}_processed"
    for file in PROCESSED_DIR.glob(f"{prefix}.*"):
        # Double check readiness to prevent partial downloads via direct link
        done_flag = Path(str(file) + ".done")
        if not done_flag.exists():
             return jsonify({"success": False, "error": "Video processing not complete."}), 400
        
        if file.stat().st_size < 100 * 1024:  # 100KB threshold
             return jsonify({"success": False, "error": "Video file is empty/corrupt."}), 500

        # Check if download is requested
        download = request.args.get("download", "false").lower() == "true"
        return send_from_directory(PROCESSED_DIR, file.name, as_attachment=download)
    return jsonify({"success": False, "error": "Processed video not found."}), 404


@app.get("/status/<video_id>")
def check_status(video_id: str):
    """
    Readiness check for processed videos.
    Checks for .failed flag, then .done flag AND valid file size.
    """
    # 1. Check for failure first
    output_filename = f"{video_id}_processed.mp4"
    failed_flag = PROCESSED_DIR / (output_filename + ".failed")
    
    if failed_flag.exists():
        try:
            with open(failed_flag, "r") as f:
                error_msg = f.read()
        except Exception:
            error_msg = "Unknown error occurred."
        return jsonify({"ready": False, "status": "failed", "error": error_msg})

    # 3. Check for alert data to surface found persons
    found_persons = []
    alert_path = PROCESSED_DIR / (f"{video_id}_processed_alert.json")
    if alert_path.exists():
        try:
            found_persons = json.loads(alert_path.read_text())
        except Exception:
            pass
            
    # 4. Determine state
    # 4. Determine state
    state = "processing"
    
    video_path = PROCESSED_DIR / output_filename
    
    # If final file exists and size is good, we are done
    if video_path.exists() and video_path.stat().st_size > 100 * 1024:
        # Check explicit done flag to be sure atomic rename finished
        done_flag = Path(str(video_path) + ".done")
        if done_flag.exists():
            state = "done"

    return jsonify({
        "ready": (state == "done"),
        "status": state,
        "video_id": video_id,
        "found_persons": found_persons,
        "download_url": f"/processed/{video_id}" if state == "done" else None
    })

@app.get("/missing_persons")
def get_missing_persons():
    """Get all active missing persons."""
    try:
        persons = face_processor.db.get_active_missing_persons()
        # Convert bytes/datetime to serializable format
        for p in persons:
            if p.get("embedding"):
                p.pop("embedding") # Don't send bytes
            if p.get("reported_date"):
                p["reported_date"] = str(p["reported_date"])
            if p.get("found_timestamp"):
                p["found_timestamp"] = str(p["found_timestamp"])
        return jsonify(persons)
    except Exception as e:
        logger.error(f"Error getting persons: {e}")
        return jsonify([]), 500


if __name__ == "__main__":
    # For local Windows demo use only; behind nginx/Gunicorn in real deployment.
    app.run(host="0.0.0.0", port=8000, debug=True)

