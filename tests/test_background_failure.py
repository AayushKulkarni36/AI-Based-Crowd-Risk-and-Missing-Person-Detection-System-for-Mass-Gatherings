
import unittest
from unittest.mock import MagicMock, patch
import sys
import os
import shutil
from pathlib import Path

# Mock deep learning dependencies
sys.modules["facenet_pytorch"] = MagicMock()
sys.modules["torch"] = MagicMock()
sys.modules["torch.nn"] = MagicMock()
sys.modules["torch.nn.functional"] = MagicMock()
sys.modules["PIL"] = MagicMock()

# Mock cv2 to avoid DLL issues in test env
sys.modules["cv2"] = MagicMock()

# Add src to path
sys.path.append(os.path.join(os.getcwd(), 'src'))

# Import app after mocking
from face_recognition import face_api

class TestBackgroundFailure(unittest.TestCase):
    def setUp(self):
        self.test_id = "test_fail_video"
        self.test_dir = Path("data/processed")
        self.test_dir.mkdir(parents=True, exist_ok=True)
        self.output_path = self.test_dir / f"{self.test_id}_processed.mp4"
        
        # Clean up previous runs
        if self.output_path.exists():
            self.output_path.unlink()
        if (self.output_path.with_suffix(".mp4.failed")).exists():
            (self.output_path.with_suffix(".mp4.failed")).unlink()
        if (self.output_path.with_suffix(".mp4.done")).exists():
            (self.output_path.with_suffix(".mp4.done")).unlink()

        self.client = face_api.app.test_client()

    def tearDown(self):
        # Clean up
        pass

    @patch('face_recognition.face_api.MassGatheringSurveillance')
    def test_process_video_async_failure(self, MockMGS):
        """
        Test that process_video_async catches exceptions and writes a .failed file.
        """
        # Setup mock to raise exception
        mock_instance = MockMGS.return_value
        mock_instance.process_cctv_stream.side_effect = RuntimeError("Simulated Pipeline Crash")
        
        # Call the async function synchronously
        print("Running process_video_async with simulated crash...")
        face_api.process_video_async(
            input_path=Path("dummy_input.mp4"), 
            output_path=self.output_path, 
            video_id=self.test_id
        )
        
        # Assertions
        failed_flag = Path(str(self.output_path) + ".failed")
        print(f"Checking for failed flag at: {failed_flag}")
        self.assertTrue(failed_flag.exists(), "Failed flag was not created!")
        
        with open(failed_flag, "r") as f:
            content = f.read()
            print(f"Failed flag content: {content}")
            self.assertIn("Simulated Pipeline Crash", content)

    def test_check_status_failed(self):
        """
        Test that /status endpoint returns 'failed' when .failed file exists.
        """
        # Create a fake .failed file
        failed_flag = Path(str(self.output_path) + ".failed")
        with open(failed_flag, "w") as f:
            f.write("Test Failure Message")
            
        # Call endpoint
        response = self.client.get(f"/status/{self.test_id}")
        data = response.get_json()
        
        print(f"Status response: {data}")
        self.assertEqual(data["status"], "failed")
        self.assertEqual(data["ready"], False)
        self.assertIn("Test Failure Message", data["error"])

if __name__ == '__main__':
    unittest.main()
