
import requests
import time
import sys
import os
from pathlib import Path

# Config
BASE_URL = "http://localhost:8000"
PHOTO_PATH = r"c:\Users\ayush\FinalYearProject\data\photos\Aayush_Shashank_Kulkarni_8874a34e.jpg"
VIDEO_PATH = r"c:\Users\ayush\FinalYearProject\data\uploads\1763029552265-WIN_20251113_15_55_22_Pro.mp4"

def check_backend():
    try:
        r = requests.get(f"{BASE_URL}/")
        print(f"Backend status: {r.status_code}")
        return True
    except Exception as e:
        print(f"Backend not reachable: {e}")
        return False

def register_person():
    print(f"Registering person from {PHOTO_PATH}...")
    try:
        with open(PHOTO_PATH, 'rb') as f:
            files = {'photo': f}
            data = {
                'name': f'Aayush Verified {int(time.time())}',
                'age': 22,
                'gender': 'Male',
                'description': 'Verification Test'
            }
            r = requests.post(f"{BASE_URL}/register_missing_person", files=files, data=data)
            print("Register response:", r.json())
            r.raise_for_status()
            return r.json()['person_id']
    except Exception as e:
        print(f"Registration failed: {e}")
        sys.exit(1)

def upload_video():
    print(f"Uploading video {VIDEO_PATH}...")
    try:
        with open(VIDEO_PATH, 'rb') as f:
            files = {'video': f}
            r = requests.post(f"{BASE_URL}/upload_video", files=files)
            print("Upload response:", r.json())
            r.raise_for_status()
            return r.json()['video_id']
    except Exception as e:
        print(f"Upload failed: {e}")
        sys.exit(1)

def poll_status(video_id):
    print(f"Polling status for {video_id}...")
    for i in range(120): # Wait up to 2 mins
        try:
            r = requests.get(f"{BASE_URL}/status/{video_id}")
            data = r.json()
            print(f"Status: {data['status']}, Ready: {data['ready']}")
            
            if data.get('found_persons'):
                print("⚠️ ALERT: Found persons:", data['found_persons'])

            if data['status'] == 'done':
                print("✅ Processing Done!")
                return data
            
            if data['status'] == 'failed':
                print("❌ Processing Failed:", data.get('error'))
                sys.exit(1)
                
            time.sleep(2)
        except Exception as e:
            print(f"Polling error: {e}")
            time.sleep(2)
    print("❌ Timed out waiting for processing")
    sys.exit(1)

def verify_download(url):
    print(f"Verifying download from {url}...")
    try:
        r = requests.get(f"{BASE_URL}{url}", stream=True)
        if r.status_code == 200:
            content_len = len(r.content)
            print(f"✅ Download successful. Size: {content_len} bytes")
            if content_len < 100000:
                print("⚠️ Warning: File seems too small.")
        else:
            print(f"❌ Download failed: {r.status_code}")
    except Exception as e:
        print(f"Download verification error: {e}")

def main():
    if not check_backend():
        print("Please start the backend (face_api.py) in another terminal first!")
        sys.exit(1)

    person_id = register_person()
    video_id = upload_video()
    result = poll_status(video_id)
    
    if result.get('download_url'):
        verify_download(result['download_url'])
    
    print("\n-------------------------------------------")
    print("VERIFICATION COMPLETE")
    print("Check logs above for 'ALERT' and '✅'")
    print("-------------------------------------------")

if __name__ == "__main__":
    main()
