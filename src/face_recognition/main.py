import os
import json
from pathlib import Path
import cv2
import time
import numpy as np
import logging
from typing import Any, Set

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

try:
    from crowd_detection.crowd_monitor import CrowdMonitor
except Exception as e:
    logger.error(f"Failed to import CrowdMonitor: {e}")
    CrowdMonitor = None

from face_recognition.face_processor import FaceProcessor
from face_recognition.database import MissingPersonDB


class MassGatheringSurveillance:
    def __init__(self) -> None:
        logger.info("🚀 Initializing Mass Gathering Surveillance...")
        try:
            if CrowdMonitor is None:
                raise ImportError("crowd_monitor not available")
            self.crowd_monitor = CrowdMonitor()
        except Exception:
            logger.warning("⚠️ CrowdMonitor fallback - using density=400")
            # Simple dummy object with get_density(frame) -> 400
            self.crowd_monitor = type(
                "DummyMonitor", (), {"get_density": lambda self, frame: 400.0}
            )()

        self.face_processor = FaceProcessor()
        self.frame_count = 0
        self.start_time = time.time()
        self.heatmap = None  # density heatmap built from face/person locations

    def process_cctv_stream(
        self,
        source: Any = 0,
        duration: int = 60,
        output_path: str | None = None,
        show_window: bool = True,
    ) -> None:
        cap = cv2.VideoCapture(source)
        end_time = time.time() + duration if duration > 0 else None
        
        # Atomic writer setup
        writer = None
        tmp_output_path = None
        
        # Alerting setup
        found_persons: Set[str] = set()
        alert_json_path = None
        if output_path:
            alert_json_path = Path(output_path).parent / (Path(output_path).stem + "_alert.json")

        try:
            while cap.isOpened():
                if end_time is not None and time.time() > end_time:
                    break
                ret, frame = cap.read()
                if not ret:
                    break

                self.frame_count += 1
                
                # LAZY INIT WRITER (Atomic pattern)
                if output_path and writer is None:
                    h, w = frame.shape[:2]
                    fps = cap.get(cv2.CAP_PROP_FPS)
                    if not fps or fps < 1:
                        fps = 25.0
                    
                    # Use .tmp extension while writing
                    tmp_output_path = str(Path(output_path).with_suffix(".tmp.mp4"))
                    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
                    writer = cv2.VideoWriter(tmp_output_path, fourcc, fps, (w, h))
                    
                    if not writer.isOpened():
                        logger.error("Failed to open VideoWriter with mp4v, trying XVID")
                        fourcc = cv2.VideoWriter_fourcc(*"XVID")
                        tmp_output_path = str(Path(output_path).with_suffix(".tmp.avi"))
                        writer = cv2.VideoWriter(tmp_output_path, fourcc, fps, (w, h))

                # FRAME SKIPPING OPTIMIZATION
                PROCESS_INTERVAL = 5  # Process 1 frame, skip 4
                
                # CROWD DENSITY & FACE PIPELINE (Run only on interval)
                if self.frame_count % PROCESS_INTERVAL == 0:
                    try:
                        density = self.crowd_monitor.get_density(frame)
                    except Exception:
                        density = 400.0
                    
                    detections = self.face_processor.process_cctv_frame(
                        frame, "Demo Camera", density
                    )
                    
                    # Update cache
                    self.cached_density = density
                    self.cached_detections = detections
                    
                    # CHECK FOR MATCHES & ALERT
                    for d in detections:
                        if d.get("match"):
                            p_name = d["match"]["name"]
                            if p_name not in found_persons:
                                found_persons.add(p_name)
                                logger.info(f"ALERT: Missing person detected → {p_name}")
                                if alert_json_path:
                                    try:
                                        alert_data = [{"name": name} for name in found_persons]
                                        with open(alert_json_path, 'w') as f:
                                            json.dump(alert_data, f)
                                    except Exception as e:
                                        logger.error(f"Failed to write alert JSON: {e}")
                else:
                    # Use cached results for skipped frames
                    density = getattr(self, 'cached_density', 0.0)
                    detections = getattr(self, 'cached_detections', [])

                # Visualize
                self._update_heatmap(frame.shape, detections)
                self._draw_results(frame, density, detections)

                if show_window:
                    cv2.imshow("Mass Gathering Surveillance", frame)
                    if cv2.waitKey(1) & 0xFF == ord('q'):
                        logger.info("🛑 User quit requested.")
                        break

                if writer is not None:
                    # Resize if needed (sanity check)
                    if frame.shape[1::-1] != (w, h):
                        frame = cv2.resize(frame, (w, h))
                    writer.write(frame)
        
        finally:
            print("🛑 Closing video resources...")
            if cap:
                cap.release()
            if writer:
                writer.release()
            cv2.destroyAllWindows()
            
            # ATOMIC RENAME
            if output_path and tmp_output_path and os.path.exists(tmp_output_path):
                try:
                    # Remove target if exists (overwrite)
                    if os.path.exists(output_path):
                        os.remove(output_path)
                    os.rename(tmp_output_path, output_path)
                    logger.info(f"Renamed atomic video to {output_path}")
                except Exception as e:
                    logger.error(f"Failed to rename tmp video: {e}")

    def _draw_results(self, frame, density: float, detections) -> None:
        # Heatmap overlay (built from historical face centroids)
        if self.heatmap is not None:
            heatmap_norm = cv2.normalize(
                self.heatmap, None, alpha=0, beta=255, norm_type=cv2.NORM_MINMAX
            ).astype(np.uint8)
            heatmap_color = cv2.applyColorMap(heatmap_norm, cv2.COLORMAP_JET)
            cv2.addWeighted(frame, 0.7, heatmap_color, 0.3, 0, frame)

        # Density overlay
        cv2.putText(
            frame,
            f"Density: {density:.0f}/100m²",
            (10, 30),
            cv2.FONT_HERSHEY_SIMPLEX,
            1,
            (0, 255, 0),
            2,
        )

        for d in detections:
            x1, y1, x2, y2 = d["bbox"]
            color = (0, 255, 0) if d["risk_level"] == "NORMAL" else (0, 0, 255)

            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)

            if d["match"]:
                label = f"{d['match']['name']} ({d['match']['confidence']:.0%})"
            else:
                label = "Unknown"

            cv2.putText(
                frame,
                label,
                (x1, y1 - 10),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                color,
                2,
            )

            cv2.putText(
                frame,
                d["risk_level"],
                (x1, y2 + 20),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                (255, 255, 0),
                2,
            )

    def _update_heatmap(self, frame_shape, detections, decay: float = 0.90, radius: int = 25) -> None:
        """
        Maintain a simple crowd density heatmap using face centroids as proxies
        for person locations. This is for visualization; core crowd risk logic
        still comes from the crowd module.
        """
        h, w = frame_shape[:2]
        if self.heatmap is None or self.heatmap.shape != (h, w):
            self.heatmap = np.zeros((h, w), dtype=np.float32)

        # Exponential decay so older activity fades out over time
        self.heatmap *= decay

        for d in detections:
            x1, y1, x2, y2 = d["bbox"]
            cx = int((x1 + x2) / 2)
            cy = int((y1 + y2) / 2)
            if 0 <= cx < w and 0 <= cy < h:
                cv2.circle(self.heatmap, (cx, cy), radius, 1.0, thickness=-1)
