"""
Alert System Module
Handles voice and visual alerts for crowd risk levels
"""
import pyttsx3
import time
from datetime import datetime
from typing import Optional
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class AlertSystem:
    """
    Manages multi-channel alert generation for crowd risk scenarios
    Supports voice alerts with cooldown mechanism
    """
    
    def __init__(self, enable_voice: bool = True, cooldown_seconds: int = 30):
        """
        Initialize alert system
        
        Args:
            enable_voice: Enable voice alerts (requires pyttsx3)
            cooldown_seconds: Minimum seconds between alerts of same type
        """
        self.enable_voice = enable_voice
        self.cooldown_seconds = cooldown_seconds
        self.last_alert_time = {}
        self.alert_history = []
        
        # Initialize voice engine
        self.voice_engine = None
        if enable_voice:
            try:
                self.voice_engine = pyttsx3.init()
                self.voice_engine.setProperty('rate', 150)
                self.voice_engine.setProperty('volume', 0.9)
                logger.info("[INFO] Voice alert system initialized")
            except Exception as e:
                logger.warning(f"[WARNING] Voice engine failed: {e}. Voice alerts disabled.")
                self.enable_voice = False
    
    def should_trigger_alert(self, risk_level: str) -> bool:
        """
        Check if alert should be triggered based on cooldown
        
        Args:
            risk_level: Risk level string (SAFE/WARNING/RISKY/CRITICAL)
        
        Returns:
            True if alert should be triggered
        """
        current_time = time.time()
        
        # Always allow CRITICAL alerts (shorter cooldown)
        if risk_level == "CRITICAL":
            cooldown = self.cooldown_seconds / 2
        else:
            cooldown = self.cooldown_seconds
        
        # Check last alert time
        if risk_level in self.last_alert_time:
            elapsed = current_time - self.last_alert_time[risk_level]
            if elapsed < cooldown:
                return False
        
        return True
    
    def generate_alert(self, risk_level: str, person_count: int, 
                      language: str = "en") -> Optional[str]:
        """
        Generate appropriate alert message
        
        Args:
            risk_level: Current risk level
            person_count: Number of persons detected
            language: Language code (en/hi/mr)
        
        Returns:
            Alert message string or None if no alert needed
        """
        # Only alert for WARNING, RISKY, CRITICAL
        if risk_level == "SAFE":
            return None
        
        # Check cooldown
        if not self.should_trigger_alert(risk_level):
            return None
        
        # Generate message based on language
        messages = {
            'en': {
                'WARNING': f"Attention! Moderate crowd density detected. {person_count} persons present. Monitor situation.",
                'RISKY': f"Warning! High crowd density. {person_count} persons detected. Take preventive action.",
                'CRITICAL': f"CRITICAL ALERT! Very high crowd density. {person_count} persons detected. Immediate intervention required!"
            },
            'hi': {
                'WARNING': f"ध्यान दें! मध्यम भीड़ का घनत्व। {person_count} लोग मौजूद हैं। स्थिति की निगरानी करें।",
                'RISKY': f"चेतावनी! अधिक भीड़ का घनत्व। {person_count} लोग पाए गए। कार्रवाई करें।",
                'CRITICAL': f"गंभीर चेतावनी! बहुत अधिक भीड़। {person_count} लोग पाए गए। तुरंत हस्तक्षेप आवश्यक!"
            },
            'mr': {
                'WARNING': f"लक्ष दया! मध्यम गर्दी. {person_count} लोक उपस्थित. परिस्थितीचे निरीक्षण करा.",
                'RISKY': f"चेतावणी! जास्त गर्दी. {person_count} लोक आढळले. कारवाई करा.",
                'CRITICAL': f"गंभीर चेतावणी! खूप जास्त गर्दी. {person_count} लोक आढळले. त्वरित हस्तक्षेप आवश्यक!"
            }
        }
        
        message = messages.get(language, messages['en']).get(risk_level)
        
        if message:
            # Update alert time
            self.last_alert_time[risk_level] = time.time()
            
            # Log alert
            self.alert_history.append({
                'timestamp': datetime.now(),
                'risk_level': risk_level,
                'person_count': person_count,
                'message': message
            })
            
            # Trigger voice alert
            if self.enable_voice and self.voice_engine:
                self._speak_alert(message)
            
            # Console log
            logger.warning(f"[ALERT] {risk_level}: {message}")
            
            return message
        
        return None
    
    def _speak_alert(self, message: str):
        """
        Speak alert message using text-to-speech
        
        Args:
            message: Alert message to speak
        """
        try:
            self.voice_engine.say(message)
            self.voice_engine.runAndWait()
        except Exception as e:
            logger.error(f"[ERROR] Voice alert failed: {e}")
    
    def get_alert_history(self, limit: int = 10):
        """
        Get recent alert history
        
        Args:
            limit: Maximum number of alerts to return
        
        Returns:
            List of recent alerts
        """
        return self.alert_history[-limit:]
    
    def clear_history(self):
        """Clear alert history"""
        self.alert_history.clear()
        self.last_alert_time.clear()
