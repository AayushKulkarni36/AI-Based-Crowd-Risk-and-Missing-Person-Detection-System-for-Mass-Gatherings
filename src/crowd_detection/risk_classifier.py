"""
Risk Classification Module
Classifies crowd density into Safe/Moderate/Risky categories
"""
import numpy as np
from typing import Tuple, List
from enum import Enum
from datetime import datetime

from config import Config


class RiskLevel(Enum):
    """Risk level enumeration"""
    SAFE = "Safe"
    MODERATE = "Moderate"
    RISKY = "Risky"
    CRITICAL = "Critical"


class RiskClassifier:
    """
    Classifies crowd risk based on person count and density metrics
    Uses configurable thresholds for different risk levels
    """
    
    def __init__(self):
        """Initialize risk classifier with thresholds from config"""
        self.safe_threshold = Config.SAFE_THRESHOLD
        self.moderate_threshold = Config.MODERATE_THRESHOLD
        self.risky_threshold = Config.RISKY_THRESHOLD
        
        # History for trend analysis
        self.count_history: List[int] = []
        self.max_history_length = 30  # Last 30 frames
        
        print(f"[INFO] RiskClassifier initialized")
        print(f"  Safe: < {self.safe_threshold} persons")
        print(f"  Moderate: {self.safe_threshold}-{self.moderate_threshold} persons")
        print(f"  Risky: {self.moderate_threshold}-{self.risky_threshold} persons")
        print(f"  Critical: > {self.risky_threshold} persons")
    
    def classify(self, person_count: int) -> Tuple[RiskLevel, str]:
        """
        Classify risk level based on person count
        
        Args:
            person_count: Number of detected persons
        
        Returns:
            Tuple of (risk_level, color_code)
            color_code: BGR color for visualization
        """
        # Update history
        self.count_history.append(person_count)
        if len(self.count_history) > self.max_history_length:
            self.count_history.pop(0)
        
        # Classify based on thresholds
        if person_count < self.safe_threshold:
            return RiskLevel.SAFE, (0, 255, 0)  # Green
        elif person_count < self.moderate_threshold:
            return RiskLevel.MODERATE, (0, 165, 255)  # Orange
        elif person_count < self.risky_threshold:
            return RiskLevel.RISKY, (0, 140, 255)  # Dark Orange
        else:
            return RiskLevel.CRITICAL, (0, 0, 255)  # Red
    
    def get_trend(self) -> str:
        """
        Analyze crowd density trend
        
        Returns:
            "Increasing", "Decreasing", or "Stable"
        """
        if len(self.count_history) < 10:
            return "Insufficient Data"
        
        # Compare recent average vs older average
        recent_avg = np.mean(self.count_history[-10:])
        older_avg = np.mean(self.count_history[-20:-10])
        
        threshold = 2  # Require 2+ person difference
        
        if recent_avg > older_avg + threshold:
            return "Increasing"
        elif recent_avg < older_avg - threshold:
            return "Decreasing"
        else:
            return "Stable"
    
    def get_statistics(self) -> dict:
        """
        Calculate statistics from count history
        
        Returns:
            Dictionary with min, max, avg, current count
        """
        if not self.count_history:
            return {
                'min': 0,
                'max': 0,
                'avg': 0.0,
                'current': 0
            }
        
        return {
            'min': int(np.min(self.count_history)),
            'max': int(np.max(self.count_history)),
            'avg': float(np.mean(self.count_history)),
            'current': self.count_history[-1]
        }
    
    def should_alert(self, risk_level: RiskLevel, last_alert_time: datetime = None) -> bool:
        """
        Determine if alert should be triggered
        
        Args:
            risk_level: Current risk level
            last_alert_time: Timestamp of last alert (None if no previous alert)
        
        Returns:
            True if alert should be triggered
        """
        # Always alert for CRITICAL
        if risk_level == RiskLevel.CRITICAL:
            if last_alert_time is None:
                return True
            
            # Check cooldown period
            elapsed = (datetime.now() - last_alert_time).total_seconds()
            return elapsed >= Config.ALERT_COOLDOWN_SECONDS
        
        # Alert for RISKY (with cooldown)
        if risk_level == RiskLevel.RISKY:
            if last_alert_time is None:
                return True
            
            elapsed = (datetime.now() - last_alert_time).total_seconds()
            return elapsed >= Config.ALERT_COOLDOWN_SECONDS * 2  # Longer cooldown
        
        return False
    
    def get_alert_message(self, risk_level: RiskLevel, person_count: int, 
                         language: str = "en") -> str:
        """
        Generate alert message in specified language
        
        Args:
            risk_level: Current risk level
            person_count: Number of persons detected
            language: Language code ('en', 'hi', 'mr')
        
        Returns:
            Alert message string
        """
        messages = {
            'en': {
                RiskLevel.SAFE: f"Crowd status: Safe. {person_count} persons detected.",
                RiskLevel.MODERATE: f"Moderate crowd density. {person_count} persons detected. Monitor situation.",
                RiskLevel.RISKY: f"Warning! High crowd density. {person_count} persons detected. Take action.",
                RiskLevel.CRITICAL: f"CRITICAL ALERT! Very high crowd density. {person_count} persons detected. Immediate intervention required!"
            },
            'hi': {
                RiskLevel.SAFE: f"भीड़ की स्थिति: सुरक्षित। {person_count} लोग पाए गए।",
                RiskLevel.MODERATE: f"मध्यम भीड़। {person_count} लोग पाए गए। स्थिति की निगरानी करें।",
                RiskLevel.RISKY: f"चेतावनी! अधिक भीड़। {person_count} लोग पाए गए। कार्रवाई करें।",
                RiskLevel.CRITICAL: f"गंभीर चेतावनी! बहुत अधिक भीड़। {person_count} लोग पाए गए। तुरंत हस्तक्षेप आवश्यक!"
            },
            'mr': {
                RiskLevel.SAFE: f"गर्दीची स्थिती: सुरक्षित। {person_count} लोक आढळले।",
                RiskLevel.MODERATE: f"मध्यम गर्दी। {person_count} लोक आढळले। परिस्थितीचे निरीक्षण करा।",
                RiskLevel.RISKY: f"चेतावणी! जास्त गर्दी। {person_count} लोक आढळले। कारवाई करा।",
                RiskLevel.CRITICAL: f"गंभीर चेतावणी! खूप जास्त गर्दी। {person_count} लोक आढळले। त्वरित हस्तक्षेप आवश्यक!"
            }
        }
        
        return messages.get(language, messages['en']).get(risk_level, "Unknown risk level")
