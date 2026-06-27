"""
Centroid / IOU Tracker
======================
Assigns a persistent track_id to each detected bounding box across frames.
Zero extra dependencies -- pure Python + NumPy only.

Usage
-----
    from .tracker import CentroidIOUTracker

    tracker = CentroidIOUTracker(iou_threshold=0.30, max_age=30)

    # Inside your frame loop:
    tracked = tracker.update(bboxes_xyxy, frame_number)
    # tracked -> [(track_id, np.array([x1,y1,x2,y2])), ...]
"""
from __future__ import annotations

import numpy as np
from typing import Dict, List, Tuple


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _iou(a: np.ndarray, b: np.ndarray) -> float:
    """Intersection-over-Union for two [x1, y1, x2, y2] boxes."""
    ix1 = max(a[0], b[0]);  iy1 = max(a[1], b[1])
    ix2 = min(a[2], b[2]);  iy2 = min(a[3], b[3])
    inter = max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)
    if inter == 0.0:
        return 0.0
    area_a = max(0.0, a[2] - a[0]) * max(0.0, a[3] - a[1])
    area_b = max(0.0, b[2] - b[0]) * max(0.0, b[3] - b[1])
    union  = area_a + area_b - inter
    return float(inter / union) if union > 0 else 0.0


# ---------------------------------------------------------------------------
# Internal track state
# ---------------------------------------------------------------------------

class _Track:
    __slots__ = ("track_id", "bbox", "last_seen", "age")

    def __init__(self, track_id: int, bbox: np.ndarray, frame: int) -> None:
        self.track_id  = track_id
        self.bbox      = bbox.astype(np.float32)
        self.last_seen = frame
        self.age       = 1


# ---------------------------------------------------------------------------
# Public tracker
# ---------------------------------------------------------------------------

class CentroidIOUTracker:
    """
    Greedy IOU tracker.

    Matched detections inherit their existing track_id; unmatched detections
    spawn new tracks.  Tracks absent for more than *max_age* frames are pruned.

    Parameters
    ----------
    iou_threshold : float
        Minimum IoU needed to associate a detection with an existing track.
    max_age : int
        Frames of absence before a track is considered dead and removed.
    """

    def __init__(self, iou_threshold: float = 0.30, max_age: int = 30) -> None:
        self.iou_threshold = iou_threshold
        self.max_age       = max_age
        self._next_id: int = 1
        self._tracks: Dict[int, _Track] = {}

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def update(
        self,
        detections: List[np.ndarray],
        frame: int,
    ) -> List[Tuple[int, np.ndarray]]:
        """
        Update tracker with detections from the current frame.

        Parameters
        ----------
        detections : list of np.ndarray
            Each element is a [x1, y1, x2, y2] float array for one person.
        frame : int
            Current frame number used for age / pruning accounting.

        Returns
        -------
        List of ``(track_id, bbox)`` tuples — one per detection this frame.
        New detections get a freshly allocated track_id; matched detections
        keep their existing one.
        """
        if not detections:
            self._prune(frame)
            return []

        active        = list(self._tracks.values())
        matched_tids: set = set()
        matched_dids: set = set()
        results: List[Tuple[int, np.ndarray]] = []

        # Build candidate (iou, track_idx, det_idx) pairs above threshold
        candidates: List[Tuple[float, int, int]] = []
        for ti, track in enumerate(active):
            for di, det in enumerate(detections):
                score = _iou(track.bbox, det)
                if score >= self.iou_threshold:
                    candidates.append((score, ti, di))

        # Greedy assignment -- best IOU first
        candidates.sort(key=lambda x: x[0], reverse=True)
        for _, ti, di in candidates:
            t = active[ti]
            if t.track_id in matched_tids or di in matched_dids:
                continue
            t.bbox      = detections[di].astype(np.float32)
            t.last_seen = frame
            t.age      += 1
            matched_tids.add(t.track_id)
            matched_dids.add(di)
            results.append((t.track_id, t.bbox.copy()))

        # Spawn new tracks for unmatched detections
        for di, det in enumerate(detections):
            if di in matched_dids:
                continue
            tid = self._next_id
            self._next_id += 1
            self._tracks[tid] = _Track(tid, det, frame)
            results.append((tid, det.astype(np.float32)))

        self._prune(frame)
        return results

    def reset(self) -> None:
        """Clear all tracks and reset the ID counter."""
        self._tracks.clear()
        self._next_id = 1

    @property
    def active_count(self) -> int:
        """Number of currently active tracks."""
        return len(self._tracks)

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _prune(self, frame: int) -> None:
        dead = [
            tid for tid, t in self._tracks.items()
            if (frame - t.last_seen) > self.max_age
        ]
        for tid in dead:
            del self._tracks[tid]
