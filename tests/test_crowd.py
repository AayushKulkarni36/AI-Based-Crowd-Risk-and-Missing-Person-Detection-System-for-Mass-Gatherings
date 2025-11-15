"""
Unit Tests for Crowd Detection Module
Run with: python -m pytest tests/test_crowd.py
"""
import pytest
import numpy as np
import cv2
from pathlib import Path
import sys

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.crowd_detection import PersonDetector, RiskClassifier, CrowdMonitor
from src.crowd_detection.risk_classifier import RiskLevel
from config import Config


class TestPersonDetector:
    """Test PersonDetector class"""
    
    def test_initialization(self):
        """Test detector initialization"""
        detector = PersonDetector()
        assert detector.model is not None
        assert detector.device in ['cpu', 'cuda']
    
    def test_detect_persons_empty_frame(self):
        """Test detection on empty frame"""
        detector = PersonDetector()
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        bboxes, count = detector.detect_persons(frame)
        assert isinstance(bboxes, list)
        assert isinstance(count, int)
        assert count >= 0
    
    def test_fps_calculation(self):
        """Test FPS calculation"""
        detector = PersonDetector()
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        
        # Process multiple frames
        for _ in range(5):
            detector.detect_persons(frame)
        
        fps = detector.get_avg_fps()
        assert fps > 0


class TestRiskClassifier:
    """Test RiskClassifier class"""
    
    def test_initialization(self):
        """Test classifier initialization"""
        classifier = RiskClassifier()
        assert classifier.safe_threshold == Config.SAFE_THRESHOLD
        assert classifier.moderate_threshold == Config.MODERATE_THRESHOLD
    
    def test_safe_classification(self):
        """Test SAFE classification"""
        classifier = RiskClassifier()
        risk, color = classifier.classify(5)
        assert risk == RiskLevel.SAFE
        assert color == (0, 255, 0)
    
    def test_moderate_classification(self):
        """Test MODERATE classification"""
        classifier = RiskClassifier()
        risk, color = classifier.classify(15)
        assert risk == RiskLevel.MODERATE
    
    def test_risky_classification(self):
        """Test RISKY classification"""
        classifier = RiskClassifier()
        risk, color = classifier.classify(35)
        assert risk == RiskLevel.RISKY
    
    def test_critical_classification(self):
        """Test CRITICAL classification"""
        classifier = RiskClassifier()
        risk, color = classifier.classify(60)
        assert risk == RiskLevel.CRITICAL
        assert color == (0, 0, 255)
    
    def test_statistics(self):
        """Test statistics calculation"""
        classifier = RiskClassifier()
        for count in [5, 10, 15, 20]:
            classifier.classify(count)
        
        stats = classifier.get_statistics()
        assert stats['min'] == 5
        assert stats['max'] == 20
        assert 10 <= stats['avg'] <= 15
    
    def test_trend_analysis(self):
        """Test trend analysis"""
        classifier = RiskClassifier()
        
        # Increasing trend
        for i in range(20):
            classifier.classify(i)
        assert classifier.get_trend() == "Increasing"
    
    def test_alert_message(self):
        """Test alert message generation"""
        classifier = RiskClassifier()
        
        # English
        msg_en = classifier.get_alert_message(RiskLevel.CRITICAL, 60, 'en')
        assert "CRITICAL" in msg_en
        assert "60" in msg_en
        
        # Hindi
        msg_hi = classifier.get_alert_message(RiskLevel.CRITICAL, 60, 'hi')
        assert "60" in msg_hi


class TestIntegration:
    """Integration tests"""
    
    def test_full_pipeline(self):
        """Test complete detection-classification pipeline"""
        detector = PersonDetector()
        classifier = RiskClassifier()
        
        # Create test frame
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        
        # Detect
        bboxes, count = detector.detect_persons(frame)
        
        # Classify
        risk, color = classifier.classify(count)
        
        # Draw
        output = detector.draw_detections(frame, bboxes, count)
        
        assert output.shape == frame.shape
        assert isinstance(risk, RiskLevel)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
