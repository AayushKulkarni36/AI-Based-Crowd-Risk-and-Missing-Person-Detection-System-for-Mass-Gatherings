#!/usr/bin/env python3
"""
Environment verification script for CrowdNexis AI Python dependencies
Run this before starting video processing to check system readiness
"""

import sys
import torch

def check_dependencies():
    """Check all required Python dependencies"""
    checks = []

    ### YOLOv8
    try:
        from ultralytics import YOLO
        checks.append(('YOLOv8 (ultralytics)', True, 'OK'))
    except ImportError as e:
        checks.append(('YOLOv8 (ultralytics)', False, str(e)))

    # OpenCV
    try:
        import cv2
        checks.append(('OpenCV (cv2)', True, cv2.__version__))
    except ImportError as e:
        checks.append(('OpenCV (cv2)', False, str(e)))

    # PyTorch
    try:
        cuda_available = torch.cuda.is_available()
        cuda_version = torch.version.cuda if cuda_available else 'N/A'
        checks.append(('PyTorch', True, f'CUDA={cuda_available} (v{cuda_version})'))
    except Exception as e:
        checks.append(('PyTorch', False, str(e)))

    # NumPy
    try:
        import numpy
        checks.append(('NumPy', True, numpy.__version__))
    except ImportError as e:
        checks.append(('NumPy', False, str(e)))

    # Print results
    print("\n" + "="*60)
    print("CROWDNEXIS_AI ENVIRONMENT VERIFICATION")
    print("="*60)

    for name, ok, info in checks:
        status = "OK" if ok else "MISSING"
        print(f"  {status:7} | {name:30} | {info}")

    print("="*60 + "\n")

    # Return success if all checks pass
    all_ok = all(ok for _, ok, _ in checks)
    return 0 if all_ok else 1

if __name__ == '__main__':
    sys.exit(check_dependencies())
