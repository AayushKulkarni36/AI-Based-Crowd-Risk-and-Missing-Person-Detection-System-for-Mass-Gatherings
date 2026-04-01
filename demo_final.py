"""
LEGACY / EXPERIMENTAL DEMO
--------------------------
This script uses YOLOv8 for face detection and a local embedding cache.
It is NOT part of the final academic Mass Gathering Surveillance system,
which uses:

- Crowd/person analysis from the crowd module
- MTCNN for face detection and alignment
- FaceNet (InceptionResnetV1, vggface2) for embeddings
- Cosine similarity against PostgreSQL-stored embeddings

Keep this file only for local experimentation; do not present it as the
production or evaluation pipeline in reports or viva.
"""

import cv2
import numpy as np
import time
import torch
import os
from ultralytics import YOLO
from facenet_pytorch import MTCNN, InceptionResnetV1
from scipy.spatial.distance import cosine
from PIL import Image
import pickle

class ProductionFaceRecognition:
    def __init__(self):
        print("PRODUCTION FACE RECOGNITION - YOLOv8 + FaceNet")
        print("=" * 60)
        
        os.makedirs("data/demo", exist_ok=True)
        
        device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        print(f"Using device: {device}")
        
        self.yolo_model = YOLO('yolov8n.pt')
        
        self.mtcnn = MTCNN(
            image_size=160, margin=0, min_face_size=20,
            thresholds=[0.6, 0.7, 0.7], factor=0.709, keep_all=True,
            device=device
        )
        self.resnet = InceptionResnetV1(pretrained='vggface2').eval().to(device)
        
        self.known_faces = self._load_known_faces()
        print(f"Known faces loaded: {len(self.known_faces)}")
        
    def _load_known_faces(self):
        known_faces = {}
        
        demo_files = [f for f in os.listdir("data/demo") if f.lower().endswith(('.jpg', '.png'))]
        if not demo_files:
            print("No demo photos found - all faces will show 'Unknown'")
            return known_faces
        
        if os.path.exists("data/demo/known_faces.pkl"):
            try:
                with open("data/demo/known_faces.pkl", 'rb') as f:
                    known_faces = pickle.load(f)
                print(f"Loaded {len(known_faces)} saved embeddings")
                return known_faces
            except:
                print("Cache corrupted - rescanning photos")
        
        for filename in demo_files:
            name = filename.split('.')[0]
            photo_path = os.path.join("data/demo", filename)
            embedding = self._extract_embedding(photo_path)
            if embedding is not None:
                known_faces[name] = embedding
                print(f"Added {name}")
        
        try:
            with open("data/demo/known_faces.pkl", 'wb') as f:
                pickle.dump(known_faces, f)
        except:
            pass
        
        return known_faces
    
    def _extract_embedding(self, image_path):
        try:
            img = cv2.imread(image_path)
            if img is None: return None
            
            img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            img_pil = Image.fromarray(img_rgb)
            
            faces = self.mtcnn(img_pil)
            if faces is None: return None
            
            if isinstance(faces, list):
                face_tensor = faces[0] if len(faces) > 0 else None
            else:
                face_tensor = faces[0] if len(faces.shape) > 3 else faces
            
            if face_tensor is None: return None
            
            if len(face_tensor.shape) == 3:
                face_tensor = face_tensor.unsqueeze(0)
            
            embedding = self.resnet(face_tensor).detach()
            return embedding.flatten()
        except:
            return None
    
    def recognize_face(self, embedding):
        if len(self.known_faces) == 0: return None
        
        best_match = None
        min_distance = float('inf')
        
        for name, known_embedding in self.known_faces.items():
            distance = cosine(embedding.numpy(), known_embedding.numpy())
            if distance < 0.40 and distance < min_distance:
                confidence = max(0.60, 1.0 - distance * 2)
                best_match = {'name': name, 'confidence': confidence, 'distance': distance}
                min_distance = distance
        
        return best_match
    
    def _extract_embedding_from_crop(self, face_crop):
        try:
            if face_crop.size == 0: return None
            rgb_crop = cv2.cvtColor(face_crop, cv2.COLOR_BGR2RGB)
            pil_crop = Image.fromarray(rgb_crop)
            faces = self.mtcnn(pil_crop)
            
            if faces is None or len(faces) == 0: return None
            
            face_tensor = faces[0] if isinstance(faces, list) else faces[0]
            if len(face_tensor.shape) == 3:
                face_tensor = face_tensor.unsqueeze(0)
            
            embedding = self.resnet(face_tensor).detach()
            return embedding.flatten()
        except:
            return None

    def run_demo(self, duration=30):
        cap = cv2.VideoCapture(0)
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        
        frame_count = 0
        start_time = time.time()
        
        print("LIVE MIRRORED YOLOv8 FACE DETECTION")
        if len(self.known_faces) == 0:
            print("DATABASE EMPTY: Add photo to data/demo/ayush.jpg")
        else:
            print(f"DATABASE: {len(self.known_faces)} known faces loaded")
        
        print("Labels: Green=Match | Red=Unknown | Yellow=Detected")
        
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret: break
            
            frame = cv2.flip(frame, 1)
            
            frame_count += 1
            fps = frame_count / (time.time() - start_time)
            elapsed = time.time() - start_time
            
            if elapsed > duration: break
            
            results = self.yolo_model(frame, conf=0.4, verbose=False)
            face_boxes = []
            
            for r in results:
                if r.boxes is not None:
                    for box in r.boxes:
                        x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                        face_boxes.append((int(x1), int(y1), int(x2), int(y2)))
            
            for i, (x1, y1, x2, y2) in enumerate(face_boxes):
                face_crop = frame[y1:y2, x1:x2]
                
                if len(self.known_faces) == 0:
                    color = (0, 255, 255)
                    label = "No Database"
                else:
                    try:
                        if face_crop.size > 0:
                            embedding = self._extract_embedding_from_crop(face_crop)
                            if embedding is not None:
                                match = self.recognize_face(embedding)
                                if match:
                                    color = (0, 255, 0)
                                    label = f"{match['name']} {match['confidence']:.0%}"
                                else:
                                    color = (0, 0, 255)
                                    label = "Unknown"
                            else:
                                color = (0, 255, 255)
                                label = "No Embedding"
                        else:
                            color = (0, 255, 255)
                            label = "Crop Fail"
                    except:
                        color = (0, 255, 255)
                        label = "Error"
                
                cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                cv2.putText(frame, label, (x1, y1-10), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
            
            db_status = f"DB: {len(self.known_faces)}" + (" EMPTY" if len(self.known_faces)==0 else "")
            cv2.putText(frame, 'YOLOv8 + FaceNet Face Recognition System', (10, 30), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
            cv2.putText(frame, f"FPS: {fps:.1f} | Faces: {len(face_boxes)} | {db_status}", 
                       (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
            
            cv2.imshow('Crowd Risk Face Recognition System', frame)
            if cv2.waitKey(1) & 0xFF == ord('q'): break
        
        cap.release()
        cv2.destroyAllWindows()
        print(f"DEMO COMPLETE! {fps:.1f} FPS")

def main():
    demo = ProductionFaceRecognition()
    demo.run_demo(duration=30)

if __name__ == "__main__":
    main()
