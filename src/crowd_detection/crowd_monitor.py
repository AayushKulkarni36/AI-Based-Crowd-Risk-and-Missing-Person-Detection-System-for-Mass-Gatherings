"""
Crowd Monitoring Controller
Orchestrates person detection, risk classification, and alert generation
"""
import cv2
import numpy as np
from datetime import datetime
from pathlib import Path
from typing import Optional
import time

try:
    import pyttsx3
    VOICE_AVAILABLE = True
except ImportError:
    VOICE_AVAILABLE = False
    print("[WARNING] pyttsx3 not available. Voice alerts disabled.")

from config import Config
from .person_detector import PersonDetector
from .risk_classifier import RiskClassifier, RiskLevel
from .utils import FPSCounter, VideoWriter, create_dashboard


class CrowdMonitor:
    """
    Main crowd monitoring controller
    Integrates detection, classification, and alerting
    """
    
    def __init__(self, video_source: Optional[str] = None):
        """
        Initialize crowd monitor
        
        Args:
            video_source: Video file path, RTSP URL, or webcam index (default: 0)
        """
        print(f"[INFO] Initializing CrowdMonitor")
        
        # Initialize components
        self.detector = PersonDetector()
        self.classifier = RiskClassifier()
        self.fps_counter = FPSCounter()
        
        # Video source
        self.video_source = video_source or Config.DEFAULT_VIDEO_SOURCE
        self.cap = None
        
        # Alert system
        self.last_alert_time = None
        self.voice_engine = self._init_voice_engine() if Config.ENABLE_VOICE_ALERTS else None
        
        # Video writer
        self.video_writer = None
        if Config.SAVE_OUTPUT_VIDEO:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_path = Config.OUTPUT_DIR / f"crowd_monitor_{timestamp}.avi"
            self.video_writer = VideoWriter(str(output_path))
        
        # Statistics
        self.frame_count = 0
        self.skip_counter = 0
        
        print("[INFO] CrowdMonitor initialized successfully")
    
    def _init_voice_engine(self):
        """Initialize text-to-speech engine"""
        if not VOICE_AVAILABLE:
            return None
        
        try:
            engine = pyttsx3.init()
            engine.setProperty('rate', 150)  # Speed
            engine.setProperty('volume', 0.9)  # Volume
            return engine
        except Exception as e:
            print(f"[WARNING] Failed to initialize voice engine: {e}")
            return None
    
    def _speak_alert(self, message: str):
        """Speak alert message (non-blocking)"""
        if self.voice_engine and Config.ENABLE_VOICE_ALERTS:
            try:
                self.voice_engine.say(message)
                self.voice_engine.runAndWait()
            except Exception as e:
                print(f"[ERROR] Voice alert failed: {e}")
    
    def start(self):
        """Start video capture and monitoring loop"""
        print(f"[INFO] Starting video capture from: {self.video_source}")
        
        # Open video source
        if isinstance(self.video_source, int):
            self.cap = cv2.VideoCapture(self.video_source)
        else:
            self.cap = cv2.VideoCapture(str(self.video_source))
        
        if not self.cap.isOpened():
            raise RuntimeError(f"Failed to open video source: {self.video_source}")
        
        # Set resolution
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, Config.FRAME_WIDTH)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, Config.FRAME_HEIGHT)
        
        print("[INFO] Monitoring started. Press 'q' to quit, 's' to save snapshot")
        
        try:
            self._monitoring_loop()
        except KeyboardInterrupt:
            print("\n[INFO] Monitoring interrupted by user")
        finally:
            self.stop()
    
    def _monitoring_loop(self):
        """Main monitoring loop"""
        while True:
            # Read frame
            ret, frame = self.cap.read()
            if not ret:
                print("[WARNING] Failed to read frame. End of video?")
                break
            
            self.frame_count += 1
            
            # Skip frames for performance (process every Nth frame)
            self.skip_counter += 1
            if self.skip_counter < Config.SKIP_FRAMES:
                continue
            self.skip_counter = 0
            
            # Start FPS timer
            self.fps_counter.start()
            
            # Detect persons
            bboxes, person_count = self.detector.detect_persons(frame)
            
            # Classify risk
            risk_level, risk_color = self.classifier.classify(person_count)
            
            # Check for alerts
            if self.classifier.should_alert(risk_level, self.last_alert_time):
                alert_msg = self.classifier.get_alert_message(
                    risk_level, person_count, Config.ALERT_LANGUAGE
                )
                print(f"[ALERT] {alert_msg}")
                self._speak_alert(alert_msg)
                self.last_alert_time = datetime.now()
            
            # Draw detections
            output_frame = self.detector.draw_detections(frame, bboxes, person_count)
            
            # Create dashboard overlay
            stats = self.classifier.get_statistics()
            trend = self.classifier.get_trend()
            dashboard_frame = create_dashboard(
                output_frame, 
                person_count=person_count,
                risk_level=risk_level,
                risk_color=risk_color,
                fps=self.detector.get_avg_fps(),
                stats=stats,
                trend=trend
            )
            
            # Stop FPS timer
            self.fps_counter.stop()
            
            # Save frame
            if self.video_writer:
                self.video_writer.write(dashboard_frame)
            
            # Display
            if Config.SHOW_REALTIME_DISPLAY:
                cv2.imshow('Crowd Risk Monitor', dashboard_frame)
                
                # Handle keyboard input
                key = cv2.waitKey(1) & 0xFF
                if key == ord('q'):
                    print("[INFO] Quit command received")
                    break
                elif key == ord('s'):
                    # Save snapshot
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    snapshot_path = Config.OUTPUT_DIR / f"snapshot_{timestamp}.jpg"
                    cv2.imwrite(str(snapshot_path), dashboard_frame)
                    print(f"[INFO] Snapshot saved: {snapshot_path}")
    
    def stop(self):
        """Release resources"""
        print("[INFO] Stopping monitor...")
        
        if self.cap:
            self.cap.release()
        
        if self.video_writer:
            self.video_writer.release()
        
        cv2.destroyAllWindows()
        
        # Print statistics
        print(f"\n{'='*50}")
        print("MONITORING STATISTICS")
        print(f"{'='*50}")
        print(f"Total Frames Processed: {self.frame_count}")
        print(f"Average FPS: {self.fps_counter.fps():.2f}")
        print(f"Total Time: {self.fps_counter.elapsed():.2f} seconds")
        
        stats = self.classifier.get_statistics()
        print(f"\nCrowd Statistics:")
        print(f"  Min Count: {stats['min']}")
        print(f"  Max Count: {stats['max']}")
        print(f"  Avg Count: {stats['avg']:.1f}")
        print(f"{'='*50}\n")
