#!/usr/bin/env python3
"""
Face Enrollment Script using FaceNet
Extracts 512-dim face embedding from a photo using facenet-pytorch

Usage:
  python enroll.py --image /path/to/photo.jpg

Output (JSON to stdout):
  {
    "success": true,
    "embedding": [float, float, ...],  ← 512-dim L2-normalized embedding
    "embedding_dim": 512,
    "face_detected": true,
    "error": null
  }

  or on failure:
  {
    "success": false,
    "embedding": null,
    "face_detected": false,
    "error": "reason"
  }

Errors go to stderr only.
"""

import sys
import json
import argparse
import torch
from pathlib import Path
import numpy as np

try:
    from facenet_pytorch import MTCNN, InceptionResnetV1
    from PIL import Image
    FACENET_AVAILABLE = True
except ImportError as e:
    FACENET_AVAILABLE = False
    print(f"ERROR: FaceNet not installed: {e}", file=sys.stderr)

def load_models():
    """Load MTCNN and InceptionResnetV1 models"""
    try:
        device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

        # Face detection
        mtcnn = MTCNN(
            image_size=160,
            margin=20,
            min_face_size=20,
            thresholds=[0.6, 0.7, 0.7],
            keep_all=False,
            device=device
        )

        # Face embedding (pretrained on VGGFace2)
        resnet = InceptionResnetV1(pretrained='vggface2').eval().to(device)

        return mtcnn, resnet, device
    except Exception as e:
        print(f"ERROR: Failed to load models: {e}", file=sys.stderr)
        return None, None, None

def get_embedding(image_path, mtcnn, resnet, device):
    """
    Extract face embedding from image
    Returns: (embedding_array, error_message)
    """
    try:
        # Load image
        img = Image.open(image_path).convert('RGB')

        # Detect face and crop
        face_tensor = mtcnn(img)

        if face_tensor is None:
            return None, "No face detected in image"

        # Ensure tensor is on correct device and has batch dimension
        if face_tensor.dim() == 3:
            face_tensor = face_tensor.unsqueeze(0)
        face_tensor = face_tensor.to(device)

        # Extract embedding
        with torch.no_grad():
            embedding = resnet(face_tensor)

        # Convert to numpy and L2-normalize
        emb = embedding.squeeze().cpu().numpy()
        norm = np.linalg.norm(emb)
        if norm > 0:
            emb = emb / norm

        return emb.tolist(), None

    except FileNotFoundError:
        return None, f"Image file not found: {image_path}"
    except Exception as e:
        return None, f"Error processing image: {str(e)}"

def main():
    if not FACENET_AVAILABLE:
        print(json.dumps({
            "success": False,
            "embedding": None,
            "face_detected": False,
            "error": "FaceNet not installed"
        }))
        sys.exit(0)  # Exit successfully - let caller handle missing dependency

    parser = argparse.ArgumentParser(description='Extract face embedding using FaceNet')
    parser.add_argument('--image', type=str, required=True, help='Path to image file')

    args = parser.parse_args()
    image_path = args.image

    # Validate file exists
    if not Path(image_path).exists():
        print(json.dumps({
            "success": False,
            "embedding": None,
            "face_detected": False,
            "error": f"Image file not found: {image_path}"
        }))
        sys.exit(0)

    try:
        # Load models
        mtcnn, resnet, device = load_models()
        if mtcnn is None:
            raise RuntimeError("Failed to load face recognition models")

        # Extract embedding
        embedding, error = get_embedding(image_path, mtcnn, resnet, device)

        if error:
            print(json.dumps({
                "success": False,
                "embedding": None,
                "face_detected": False,
                "error": error
            }))
        else:
            print(json.dumps({
                "success": True,
                "embedding": embedding,
                "embedding_dim": len(embedding),
                "face_detected": True,
                "error": None
            }))

    except Exception as e:
        print(f"ERROR: {str(e)}", file=sys.stderr)
        print(json.dumps({
            "success": False,
            "embedding": None,
            "face_detected": False,
            "error": str(e)
        }))
        sys.exit(0)

if __name__ == '__main__':
    main()
