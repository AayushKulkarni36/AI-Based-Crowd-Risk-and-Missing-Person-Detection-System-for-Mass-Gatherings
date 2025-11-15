"""
Utility Functions
Helper functions for FPS calculation, video writing, and visualization
"""
import cv2
import numpy as np
import time
from datetime import datetime
from typing import Tuple

from .risk_classifier import RiskLevel


class FPSCounter:
    """Track FPS performance"""
    
    def __init__(self):
        self._start = None
        self._end = None
        self._num_frames = 0
    
    def start(self):
        """Start timer"""
        self._start = datetime.now()
        return self
    
    def stop(self):
        """Stop timer"""
        self._end = datetime.now()
        self._num_frames += 1
    
    def elapsed(self) -> float:
        """Get elapsed time in seconds"""
        if self._end is None:
            return (datetime.now() - self._start).total_seconds()
        return (self._end - self._start).total_seconds()
    
    def fps(self) -> float:
        """Calculate FPS"""
        elapsed = self.elapsed()
        return self._num_frames / elapsed if elapsed > 0 else 0.0


class VideoWriter:
    """Wrapper for OpenCV VideoWriter"""
    
    def __init__(self, output_path: str, fps: int = 20, 
                 frame_size: Tuple[int, int] = (640, 480)):
        """
        Initialize video writer
        
        Args:
            output_path: Output video file path
            fps: Frames per second
            frame_size: (width, height)
        """
        self.output_path = output_path
        fourcc = cv2.VideoWriter_fourcc(*'XVID')
        self.writer = cv2.VideoWriter(output_path, fourcc, fps, frame_size)
        print(f"[INFO] VideoWriter initialized: {output_path}")
    
    def write(self, frame: np.ndarray):
        """Write frame to video"""
        self.writer.write(frame)
    
    def release(self):
        """Release writer"""
        self.writer.release()
        print(f"[INFO] Video saved: {self.output_path}")


def create_dashboard(frame: np.ndarray, person_count: int, 
                     risk_level: RiskLevel, risk_color: Tuple[int, int, int],
                     fps: float, stats: dict, trend: str) -> np.ndarray:
    """
    Create dashboard overlay with statistics
    
    Args:
        frame: Input frame
        person_count: Current person count
        risk_level: Current risk level
        risk_color: BGR color for risk level
        fps: Current FPS
        stats: Statistics dictionary
        trend: Trend string
    
    Returns:
        Frame with dashboard overlay
    """
    dashboard = frame.copy()
    height, width = dashboard.shape[:2]
    
    # Create semi-transparent overlay panel
    overlay = dashboard.copy()
    panel_height = 120
    cv2.rectangle(overlay, (0, 0), (width, panel_height), (0, 0, 0), -1)
    dashboard = cv2.addWeighted(dashboard, 0.6, overlay, 0.4, 0)
    
    # Timestamp
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cv2.putText(dashboard, timestamp, (10, 25),
               cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)
    
    # Current count (large)
    count_text = f"Count: {person_count}"
    cv2.putText(dashboard, count_text, (10, 60),
               cv2.FONT_HERSHEY_SIMPLEX, 1.2, (255, 255, 255), 2)
    
    # Risk level
    risk_text = f"Risk: {risk_level.value.upper()}"
    cv2.putText(dashboard, risk_text, (10, 95),
               cv2.FONT_HERSHEY_SIMPLEX, 0.8, risk_color, 2)
    
    # FPS
    fps_text = f"FPS: {fps:.1f}"
    cv2.putText(dashboard, fps_text, (width - 150, 30),
               cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
    
    # Statistics
    stats_text = f"Min/Max/Avg: {stats['min']}/{stats['max']}/{stats['avg']:.1f}"
    cv2.putText(dashboard, stats_text, (width - 400, 65),
               cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)
    
    # Trend
    trend_color = (0, 255, 0) if trend == "Decreasing" else (0, 165, 255) if trend == "Stable" else (0, 0, 255)
    trend_text = f"Trend: {trend}"
    cv2.putText(dashboard, trend_text, (width - 300, 95),
               cv2.FONT_HERSHEY_SIMPLEX, 0.6, trend_color, 2)
    
    # Risk level indicator bar
    bar_width = int(width * 0.3)
    bar_height = 15
    bar_x = width - bar_width - 10
    bar_y = panel_height - 25
    
    cv2.rectangle(dashboard, (bar_x, bar_y), (bar_x + bar_width, bar_y + bar_height),
                 (100, 100, 100), -1)
    
    # Fill bar based on count
    from config import Config
    max_threshold = Config.RISKY_THRESHOLD * 1.5
    fill_ratio = min(person_count / max_threshold, 1.0)
    fill_width = int(bar_width * fill_ratio)
    cv2.rectangle(dashboard, (bar_x, bar_y), (bar_x + fill_width, bar_y + bar_height),
                 risk_color, -1)
    
    return dashboard


def resize_frame(frame: np.ndarray, width: int = 640) -> np.ndarray:
    """
    Resize frame maintaining aspect ratio
    
    Args:
        frame: Input frame
        width: Target width
    
    Returns:
        Resized frame
    """
    height, orig_width = frame.shape[:2]
    aspect_ratio = height / orig_width
    new_height = int(width * aspect_ratio)
    return cv2.resize(frame, (width, new_height))
