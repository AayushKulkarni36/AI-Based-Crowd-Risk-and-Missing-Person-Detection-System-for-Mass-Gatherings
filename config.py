"""
Centralized Configuration Management
Loads settings from .env and provides validation
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class Config:
    """Application configuration class"""
    
    # Project Paths
    BASE_DIR = Path(__file__).parent
    SRC_DIR = BASE_DIR / "src"
    MODELS_DIR = BASE_DIR / "models"
    DATA_DIR = BASE_DIR / "data"
    OUTPUT_DIR = DATA_DIR / "outputs"
    
    # Ensure directories exist
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    # Project Settings
    PROJECT_NAME = os.getenv("PROJECT_NAME", "Crowd Risk Detection")
    DEBUG_MODE = os.getenv("DEBUG_MODE", "True").lower() == "true"
    
    # Video Source Configuration
    DEFAULT_VIDEO_SOURCE = int(os.getenv("DEFAULT_VIDEO_SOURCE", "0"))
    RTSP_URL = os.getenv("RTSP_URL", "")
    
    # Model Configuration
    YOLO_MODEL = os.getenv("YOLO_MODEL", "yolov5s")
    YOLO_WEIGHTS_PATH = MODELS_DIR / "yolo" / f"{YOLO_MODEL}.pt"
    CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", "0.45"))
    IOU_THRESHOLD = float(os.getenv("IOU_THRESHOLD", "0.45"))
    
    # Risk Classification Thresholds
    SAFE_THRESHOLD = int(os.getenv("SAFE_THRESHOLD", "10"))
    MODERATE_THRESHOLD = int(os.getenv("MODERATE_THRESHOLD", "25"))
    RISKY_THRESHOLD = int(os.getenv("RISKY_THRESHOLD", "50"))
    
    # Performance Settings
    TARGET_FPS = int(os.getenv("TARGET_FPS", "15"))
    FRAME_WIDTH = int(os.getenv("FRAME_WIDTH", "640"))
    FRAME_HEIGHT = int(os.getenv("FRAME_HEIGHT", "480"))
    SKIP_FRAMES = int(os.getenv("SKIP_FRAMES", "2"))
    
    # Alert Configuration
    ENABLE_VOICE_ALERTS = os.getenv("ENABLE_VOICE_ALERTS", "True").lower() == "true"
    ALERT_COOLDOWN_SECONDS = int(os.getenv("ALERT_COOLDOWN_SECONDS", "30"))
    ALERT_LANGUAGE = os.getenv("ALERT_LANGUAGE", "en")
    
    # Database
    DB_PATH = BASE_DIR / os.getenv("DB_PATH", "data/crowd_monitoring.db")
    
    # Output Settings
    SAVE_OUTPUT_VIDEO = os.getenv("SAVE_OUTPUT_VIDEO", "True").lower() == "true"
    SHOW_REALTIME_DISPLAY = os.getenv("SHOW_REALTIME_DISPLAY", "True").lower() == "true"
    
    # Person Detection Class ID (COCO dataset)
    PERSON_CLASS_ID = 0
    
    @classmethod
    def validate(cls):
        """Validate critical configuration settings"""
        errors = []
        
        if cls.SAFE_THRESHOLD >= cls.MODERATE_THRESHOLD:
            errors.append("SAFE_THRESHOLD must be < MODERATE_THRESHOLD")
        
        if cls.MODERATE_THRESHOLD >= cls.RISKY_THRESHOLD:
            errors.append("MODERATE_THRESHOLD must be < RISKY_THRESHOLD")
        
        if cls.TARGET_FPS <= 0:
            errors.append("TARGET_FPS must be > 0")
        
        if cls.CONFIDENCE_THRESHOLD < 0 or cls.CONFIDENCE_THRESHOLD > 1:
            errors.append("CONFIDENCE_THRESHOLD must be between 0 and 1")
        
        if errors:
            raise ValueError(f"Configuration errors:\n" + "\n".join(f"  - {e}" for e in errors))
        
        return True

# Validate configuration on import
Config.validate()
