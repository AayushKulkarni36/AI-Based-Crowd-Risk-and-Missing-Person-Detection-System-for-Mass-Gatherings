"""
Video Processing Utilities
Provides functions for reading, processing, and saving video frames
"""
import logging
from typing import Generator, List, Optional
from datetime import datetime

import cv2
import numpy as np

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def read_video_frames(video_path: str) -> Generator[np.ndarray, None, None]:
    """
    Generator function that yields video frames one at a time.
    
    Args:
        video_path: Path to video file or camera index (0 for webcam)
    
    Yields:
        np.ndarray: BGR frame as numpy array
    
    Raises:
        FileNotFoundError: If video file doesn't exist
        ValueError: If video cannot be opened
    
    Example:
        >>> for frame in read_video_frames("video.mp4"):
        ...     process_frame(frame)
    """
    # Handle camera index
    if isinstance(video_path, str) and video_path.isdigit():
        video_path = int(video_path)
    
    # Open video capture
    cap = cv2.VideoCapture(video_path)
    
    if not cap.isOpened():
        error_msg = f"Failed to open video source: {video_path}"
        logger.error(f"[ERROR] {error_msg}")
        raise ValueError(error_msg)
    
    try:
        frame_count = 0
        while True:
            ret, frame = cap.read()
            
            if not ret:
                logger.debug(f"[DEBUG] End of video reached at frame {frame_count}")
                break
            
            frame_count += 1
            yield frame
            
    except Exception as e:
        logger.error(f"[ERROR] Error reading video frames: {e}")
        raise
    finally:
        cap.release()
        logger.info(f"[INFO] Video capture released. Total frames read: {frame_count}")


def save_video_output(frames: List[np.ndarray], output_path: str, fps: float = 30.0) -> bool:
    """
    Save a list of frames as a video file.
    
    Args:
        frames: List of BGR frames (numpy arrays)
        output_path: Output video file path
        fps: Frames per second for output video
    
    Returns:
        bool: True if successful, False otherwise
    
    Raises:
        ValueError: If frames list is empty or invalid
    
    Example:
        >>> frames = [frame1, frame2, frame3]
        >>> save_video_output(frames, "output.mp4", fps=25.0)
    """
    if not frames:
        error_msg = "Cannot save video: frames list is empty"
        logger.error(f"[ERROR] {error_msg}")
        raise ValueError(error_msg)
    
    # Get frame dimensions from first frame
    first_frame = frames[0]
    if len(first_frame.shape) != 3:
        error_msg = "Invalid frame format: expected 3D array (height, width, channels)"
        logger.error(f"[ERROR] {error_msg}")
        raise ValueError(error_msg)
    
    height, width = first_frame.shape[:2]
    
    # Determine codec (use MP4V for .mp4, XVID for .avi)
    file_ext = output_path.lower().split('.')[-1]
    if file_ext == 'mp4':
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    elif file_ext == 'avi':
        fourcc = cv2.VideoWriter_fourcc(*'XVID')
    else:
        # Default to mp4v
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        logger.warning(f"[WARN] Unknown file extension '{file_ext}', using mp4v codec")
    
    # Create video writer
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
    
    if not out.isOpened():
        error_msg = f"Failed to create video writer for: {output_path}"
        logger.error(f"[ERROR] {error_msg}")
        return False
    
    try:
        saved_count = 0
        for frame in frames:
            # Ensure frame dimensions match
            if frame.shape[:2] != (height, width):
                logger.warning(
                    f"[WARN] Frame {saved_count} has dimensions {frame.shape[:2]}, "
                    f"expected ({height}, {width}). Resizing..."
                )
                frame = cv2.resize(frame, (width, height))
            
            out.write(frame)
            saved_count += 1
        
        logger.info(f"[INFO] Successfully saved {saved_count} frames to {output_path}")
        return True
        
    except Exception as e:
        logger.error(f"[ERROR] Error writing video: {e}")
        return False
    finally:
        out.release()


def resize_frame(frame: np.ndarray, target_width: int) -> np.ndarray:
    """
    Resize frame to target width while maintaining aspect ratio.
    
    Args:
        frame: Input BGR frame (numpy array)
        target_width: Desired width in pixels
    
    Returns:
        np.ndarray: Resized frame with same aspect ratio
    
    Raises:
        ValueError: If target_width is invalid
    
    Example:
        >>> resized = resize_frame(frame, 640)
    """
    if target_width <= 0:
        error_msg = f"Invalid target_width: {target_width}. Must be > 0"
        logger.error(f"[ERROR] {error_msg}")
        raise ValueError(error_msg)
    
    if frame is None or frame.size == 0:
        error_msg = "Invalid frame: frame is None or empty"
        logger.error(f"[ERROR] {error_msg}")
        raise ValueError(error_msg)
    
    # Get current dimensions
    height, width = frame.shape[:2]
    
    # Calculate aspect ratio
    aspect_ratio = height / width
    
    # Calculate new height to maintain aspect ratio
    target_height = int(target_width * aspect_ratio)
    
    # Resize frame
    resized = cv2.resize(frame, (target_width, target_height), interpolation=cv2.INTER_LINEAR)
    
    logger.debug(
        f"[DEBUG] Resized frame from {width}x{height} to {target_width}x{target_height}"
    )
    
    return resized


def add_timestamp(frame: np.ndarray, 
                  timestamp: Optional[datetime] = None,
                  position: tuple = (10, 30),
                  font_scale: float = 0.7,
                  color: tuple = (0, 255, 0),
                  thickness: int = 2) -> np.ndarray:
    """
    Overlay timestamp on video frame.
    
    Args:
        frame: Input BGR frame (numpy array)
        timestamp: Optional datetime object (uses current time if None)
        position: (x, y) position for timestamp text (top-left corner)
        font_scale: Font scale factor
        color: BGR color tuple for text (default: green)
        thickness: Text thickness
    
    Returns:
        np.ndarray: Frame with timestamp overlay
    
    Example:
        >>> frame_with_time = add_timestamp(frame)
        >>> custom_time = add_timestamp(frame, datetime.now(), (20, 50))
    """
    if frame is None or frame.size == 0:
        error_msg = "Invalid frame: frame is None or empty"
        logger.error(f"[ERROR] {error_msg}")
        raise ValueError(error_msg)
    
    # Use current time if not provided
    if timestamp is None:
        timestamp = datetime.now()
    
    # Format timestamp string
    timestamp_str = timestamp.strftime("%Y-%m-%d %H:%M:%S")
    
    # Create a copy to avoid modifying original
    output_frame = frame.copy()
    
    # Add text overlay
    cv2.putText(
        output_frame,
        timestamp_str,
        position,
        cv2.FONT_HERSHEY_SIMPLEX,
        font_scale,
        color,
        thickness,
        cv2.LINE_AA
    )
    
    return output_frame


if __name__ == "__main__":
    """
    Test script for video utilities
    """
    import sys
    from pathlib import Path
    
    print("=" * 60)
    print("Video Utilities Test")
    print("=" * 60)
    
    # Test 1: Read frames from video (if provided)
    if len(sys.argv) > 1:
        video_path = sys.argv[1]
        print(f"\n[TEST 1] Reading frames from: {video_path}")
        try:
            frame_count = 0
            for frame in read_video_frames(video_path):
                frame_count += 1
                if frame_count <= 3:
                    print(f"  Frame {frame_count}: shape={frame.shape}")
                if frame_count >= 10:  # Limit for testing
                    break
            print(f"  Successfully read {frame_count} frames")
        except Exception as e:
            print(f"  ERROR: {e}")
    
    # Test 2: Resize frame
    print("\n[TEST 2] Testing resize_frame()")
    try:
        test_frame = np.zeros((480, 640, 3), dtype=np.uint8)
        resized = resize_frame(test_frame, 320)
        print(f"  Original: {test_frame.shape}")
        print(f"  Resized: {resized.shape}")
        print("  ✓ Resize test passed")
    except Exception as e:
        print(f"  ERROR: {e}")
    
    # Test 3: Add timestamp
    print("\n[TEST 3] Testing add_timestamp()")
    try:
        test_frame = np.zeros((480, 640, 3), dtype=np.uint8)
        timestamped = add_timestamp(test_frame)
        print(f"  Frame shape: {timestamped.shape}")
        print("  ✓ Timestamp test passed")
    except Exception as e:
        print(f"  ERROR: {e}")
    
    # Test 4: Save video (create test frames)
    print("\n[TEST 4] Testing save_video_output()")
    try:
        test_frames = [np.random.randint(0, 255, (100, 200, 3), dtype=np.uint8) 
                      for _ in range(5)]
        output_path = "test_output.mp4"
        success = save_video_output(test_frames, output_path, fps=10.0)
        if success:
            print(f"  ✓ Successfully saved test video to {output_path}")
            # Clean up
            if Path(output_path).exists():
                Path(output_path).unlink()
                print(f"  Cleaned up test file: {output_path}")
        else:
            print("  ✗ Failed to save video")
    except Exception as e:
        print(f"  ERROR: {e}")
    
    print("\n" + "=" * 60)
    print("Test completed")
    print("=" * 60)

