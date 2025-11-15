"""
Main Application Entry Point
Run this file to start crowd monitoring
"""
import sys
import argparse
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent))

from config import Config
from src.crowd_detection import CrowdMonitor


def parse_arguments():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(
        description="AI-Based Crowd Risk Detection System"
    )
    
    parser.add_argument(
        '--source', '-s',
        type=str,
        default=None,
        help='Video source: webcam index (0), video file path, or RTSP URL'
    )
    
    parser.add_argument(
        '--no-display',
        action='store_true',
        help='Disable real-time display window'
    )
    
    parser.add_argument(
        '--no-save',
        action='store_true',
        help='Disable output video saving'
    )
    
    parser.add_argument(
        '--no-voice',
        action='store_true',
        help='Disable voice alerts'
    )
    
    return parser.parse_args()


def main():
    """Main function"""
    print(f"\n{'='*60}")
    print(f"  {Config.PROJECT_NAME}")
    print(f"  Real-Time Crowd Risk Detection & Monitoring")
    print(f"{'='*60}\n")
    
    # Parse arguments
    args = parse_arguments()
    
    # Override config with command line args
    if args.no_display:
        Config.SHOW_REALTIME_DISPLAY = False
    if args.no_save:
        Config.SAVE_OUTPUT_VIDEO = False
    if args.no_voice:
        Config.ENABLE_VOICE_ALERTS = False
    
    # Determine video source
    video_source = args.source
    if video_source is None:
        video_source = Config.DEFAULT_VIDEO_SOURCE
    elif video_source.isdigit():
        video_source = int(video_source)
    
    # Print configuration
    print("[CONFIG] Active Settings:")
    print(f"  Video Source: {video_source}")
    print(f"  Model: {Config.YOLO_MODEL}")
    print(f"  Target FPS: {Config.TARGET_FPS}")
    print(f"  Display: {'ON' if Config.SHOW_REALTIME_DISPLAY else 'OFF'}")
    print(f"  Save Video: {'ON' if Config.SAVE_OUTPUT_VIDEO else 'OFF'}")
    print(f"  Voice Alerts: {'ON' if Config.ENABLE_VOICE_ALERTS else 'OFF'}")
    print(f"\n[THRESHOLDS]")
    print(f"  Safe: < {Config.SAFE_THRESHOLD}")
    print(f"  Moderate: {Config.SAFE_THRESHOLD}-{Config.MODERATE_THRESHOLD}")
    print(f"  Risky: {Config.MODERATE_THRESHOLD}-{Config.RISKY_THRESHOLD}")
    print(f"  Critical: > {Config.RISKY_THRESHOLD}\n")
    
    # Initialize and start monitor
    try:
        monitor = CrowdMonitor(video_source=video_source)
        monitor.start()
    except Exception as e:
        print(f"\n[ERROR] Application failed: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    print("\n[INFO] Application terminated successfully")
    return 0


if __name__ == "__main__":
    sys.exit(main())
