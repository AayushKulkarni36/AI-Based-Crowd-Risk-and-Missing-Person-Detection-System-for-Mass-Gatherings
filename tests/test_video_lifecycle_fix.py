
import unittest
from unittest.mock import MagicMock, patch
import cv2
import sys
import os
from unittest.mock import MagicMock

# Mock facenet_pytorch BEFORE importing project modules
sys.modules["facenet_pytorch"] = MagicMock()

# Add src to path
sys.path.append(os.path.join(os.getcwd(), 'src'))

from face_recognition.main import MassGatheringSurveillance

class TestVideoLifecycle(unittest.TestCase):
    
    @patch('cv2.VideoCapture')
    @patch('cv2.VideoWriter')
    @patch('cv2.destroyAllWindows')
    @patch('cv2.imshow')
    @patch('cv2.waitKey')
    def test_release_called_on_exception(self, mock_wait, mock_imshow, mock_destroy, mock_writer_cls, mock_cap_cls):
        """
        Verify that cap.release() and writer.release() are called even if an exception
        occurs during processing.
        """
        # Setup mocks
        mock_cap = MagicMock()
        mock_cap.isOpened.return_value = True
        # Simulate reading a few frames
        mock_cap.read.side_effect = [(True, MagicMock()), (True, MagicMock()), Exception("Simulated Loop Crash")]
        mock_cap_cls.return_value = mock_cap
        
        mock_writer = MagicMock()
        mock_writer_cls.return_value = mock_writer
        
        # Instantiate class
        mgs = MassGatheringSurveillance()
        
        # Override dependencies to avoid side effects
        mgs.crowd_monitor = MagicMock()
        mgs.crowd_monitor.get_density.return_value = 100.0
        mgs.face_processor = MagicMock()
        mgs.face_processor.process_cctv_frame.return_value = []
        
        # Run process_cctv_stream and expect the Simulated Exception
        print("Running process_cctv_stream with simulated crash...")
        try:
            mgs.process_cctv_stream(output_path="dummy.mp4", show_window=False)
        except Exception as e:
            print(f"Caught expected exception: {e}")
        
        # Assertions
        print("Verifying release() calls...")
        mock_cap.release.assert_called_once()
        mock_writer.release.assert_called_once()
        mock_destroy.assert_called_once()
        print("SUCCESS: VideoWriter was released correctly!")

if __name__ == '__main__':
    unittest.main()
