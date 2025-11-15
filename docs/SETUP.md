# Detailed Setup Guide

This guide provides step-by-step instructions for setting up the AI-Based Crowd Risk and Missing Person Detection System.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Database Setup](#database-setup)
3. [Model Download](#model-download)
4. [Environment Configuration](#environment-configuration)
5. [Troubleshooting](#troubleshooting)
6. [FAQ](#faq)

---

## Prerequisites

### Required Software

#### 1. Node.js (v18 or higher)

**Windows:**
1. Download from [nodejs.org](https://nodejs.org/)
2. Run the installer
3. Verify installation:
   ```bash
   node --version
   npm --version
   ```


#### 2. Python (3.9 or higher)

**Windows:**
1. Download from [python.org](https://www.python.org/downloads/)
2. **Important**: Check "Add Python to PATH" during installation
3. Verify installation:
   ```bash
   python --version
   pip --version
   ```

#### 3. PostgreSQL (15 or higher)

**Windows:**
1. Download from [postgresql.org/download/windows/](https://www.postgresql.org/download/windows/)
2. Run the installer
3. Remember the postgres user password you set
4. PostgreSQL service should start automatically



#### 4. PostGIS Extension

**Windows:**
- PostGIS is usually included in the PostgreSQL installer
- Or download from [postgis.net/windows_downloads/](https://postgis.net/windows_downloads/)


#### 5. Git

**Windows:**
- Download from [git-scm.com](https://git-scm.com/download/win)

```

---

## Database Setup

### Step 1: Install PostgreSQL

Follow the installation instructions above for your operating system.

### Step 2: Create Database User (if needed)

**Windows (using pgAdmin or psql):**
```sql
CREATE USER postgres WITH PASSWORD 'your_password';
ALTER USER postgres CREATEDB;
```



Then in psql:
```sql
CREATE USER your_username WITH PASSWORD 'your_password';
ALTER USER your_username CREATEDB;
\q
```

### Step 3: Create Database

**Option A: Using the Setup Script (Recommended)**

```bash
python scripts/setup_postgres_db.py
```

This script will:
- Create the `missing_persons` database
- Enable the PostGIS extension
- Create necessary tables

**Option B: Manual Setup**

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE missing_persons;

# Connect to the new database
\c missing_persons

# Enable PostGIS
CREATE EXTENSION postgis;

# Verify PostGIS installation
SELECT PostGIS_Version();

# Exit
\q
```

### Step 4: Verify Database Connection

Test the connection:

```bash
python scripts/test_postgres_setup.py
```

Expected output:
```
 Database connection successful
 PostGIS extension enabled
 Tables created successfully
```

### Step 5: Sample Data (Optional)

To add sample data for testing:

```sql
-- Connect to database
psql -U postgres -d missing_persons

-- Insert sample missing person
INSERT INTO missing_persons (name, age, gender, description, last_seen_location, status)
VALUES ('John Doe', 25, 'Male', 'Brown hair, blue eyes, 6 feet tall', 'Central Park', 'missing');

-- View data
SELECT * FROM missing_persons;
```

---

## Model Download

### Automatic Download (Recommended)

The YOLOv5 model is automatically downloaded by the Ultralytics library on first use. No manual action required.

**Location:** `~/.ultralytics/weights/yolov5s.pt` (or `C:\Users\YourName\.ultralytics\weights\` on Windows)

### Manual Download (Optional)

If you want to download the model manually:

1. **Using Ultralytics:**
   ```python
   from ultralytics import YOLO
   model = YOLO('yolov5s.pt')  # Downloads automatically
   ```

2. **Direct Download:**
   - Visit [Ultralytics YOLOv5 Releases](https://github.com/ultralytics/yolov5/releases)
   - Download `yolov5s.pt` (smallest, fastest model)
   - Place in `models/yolo/` directory

### Alternative Models

You can use different YOLOv5 variants:

- `yolov5s.pt` - Small (14 MB) - Fastest, good accuracy
- `yolov5m.pt` - Medium (42 MB) - Balanced
- `yolov5l.pt` - Large (90 MB) - Higher accuracy
- `yolov5x.pt` - Extra Large (168 MB) - Best accuracy

To use a different model, set in `.env`:
```env
YOLO_MODEL=yolov5m
```

---

## Environment Configuration

### Step 1: Create .env File

Copy the example file:

```bash
# Windows
copy docs\env.example .env

# Linux/macOS
cp docs/env.example .env
```

### Step 2: Configure Database Settings

Edit `.env` and update these values:

```env
# Database Configuration
DB_HOST=localhost          # Database server address
DB_PORT=5432              # PostgreSQL default port
DB_NAME=missing_persons   # Database name
DB_USER=postgres          # Your PostgreSQL username
DB_PASSWORD=your_password # Your PostgreSQL password
DB_SSLMODE=prefer         # SSL mode (prefer/require/disable)
DB_MIN_CONN=1             # Minimum connection pool size
DB_MAX_CONN=5             # Maximum connection pool size
DB_POOL_MAX=10            # Maximum pool connections
```

### Step 3: Configure Application Settings

```env
# Application
PORT=5000                 # Backend server port
NODE_ENV=development      # Environment (development/production)

# Python/AI Configuration
PROJECT_NAME=Crowd Risk Detection
DEBUG_MODE=True           # Enable debug logging
YOLO_MODEL=yolov5s        # YOLO model variant
CONFIDENCE_THRESHOLD=0.45 # Detection confidence (0-1)
IOU_THRESHOLD=0.45        # Intersection over Union threshold

# Risk Thresholds
SAFE_THRESHOLD=10         # People count for "Safe" level
MODERATE_THRESHOLD=25     # People count for "Moderate" level
RISKY_THRESHOLD=50        # People count for "Risky" level

# Performance
TARGET_FPS=15             # Target frames per second
FRAME_WIDTH=640           # Video frame width
FRAME_HEIGHT=480          # Video frame height
SKIP_FRAMES=2             # Frames to skip for performance

# Alerts
ENABLE_VOICE_ALERTS=True
ALERT_COOLDOWN_SECONDS=30
ALERT_LANGUAGE=en

# Video Source
DEFAULT_VIDEO_SOURCE=0    # 0 for webcam, or RTSP URL
RTSP_URL=                 # RTSP stream URL (if using)

# Output
SAVE_OUTPUT_VIDEO=True
SHOW_REALTIME_DISPLAY=True
```

### Step 4: Verify Configuration

Test that your configuration is loaded correctly:

```python
# Python
python -c "from config import Config; print(Config.DB_NAME)"

# Or run the test script
python scripts/test_postgres_setup.py
```

---

## Troubleshooting

### Database Connection Issues

**Error: "Connection refused"**
- **Solution**: Ensure PostgreSQL service is running
  ```bash
  # Windows
  services.msc  # Find "postgresql" service and start it
  
  # Linux
  sudo systemctl start postgresql
  
  # macOS
  brew services start postgresql@15
  ```

**Error: "password authentication failed"**
- **Solution**: Verify username and password in `.env`
- Check PostgreSQL authentication settings in `pg_hba.conf`

**Error: "database does not exist"**
- **Solution**: Run the setup script: `python scripts/setup_postgres_db.py`

**Error: "extension postgis does not exist"**
- **Solution**: Install PostGIS extension:
  ```sql
  CREATE EXTENSION postgis;
  ```

### Python Environment Issues

**Error: "No module named 'ultralytics'"**
- **Solution**: Install dependencies:
  ```bash
  pip install -r requirements.txt
  ```

**Error: "Microsoft Visual C++ 14.0 is required" (Windows)**
- **Solution**: Install [Visual C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)

**Error: "Permission denied" (Linux/macOS)**
- **Solution**: Use virtual environment:
  ```bash
  python -m venv venv
  source venv/bin/activate
  pip install -r requirements.txt
  ```

### Node.js Issues

**Error: "Cannot find module"**
- **Solution**: Install dependencies:
  ```bash
  cd backend && npm install
  cd ../frontend && npm install
  ```

**Error: "Port 5000 already in use"**
- **Solution**: Change port in `.env` or kill the process:
  ```bash
  # Windows
  netstat -ano | findstr :5000
  taskkill /PID <PID> /F
  
  # Linux/macOS
  lsof -ti:5000 | xargs kill
  ```

### Model Download Issues

**Error: "Model download failed"**
- **Solution**: Check internet connection
- Manually download and place in `models/yolo/`
- Or set `YOLO_MODEL` to a different variant

### Video Processing Issues

**Error: "Cannot open video file"**
- **Solution**: 
  - Verify video file path is correct
  - Check video format is supported (MP4, AVI, MOV)
  - Ensure file is not corrupted

**Error: "Out of memory"**
- **Solution**:
  - Use smaller video files
  - Increase `SKIP_FRAMES` in `.env`
  - Reduce `FRAME_WIDTH` and `FRAME_HEIGHT`

---

## FAQ

### Q: Can I use SQLite instead of PostgreSQL?

A: The project was migrated from SQLite to PostgreSQL for better performance and PostGIS support. SQLite support is deprecated.

### Q: How do I change the detection model?

A: Set `YOLO_MODEL` in `.env` to `yolov5s`, `yolov5m`, `yolov5l`, or `yolov5x`.

### Q: Can I use a webcam instead of video files?

A: Yes, set `DEFAULT_VIDEO_SOURCE=0` in `.env` (0 is the default webcam).

### Q: How do I process multiple videos?

A: Use the web interface to upload videos one at a time, or modify the Python script to process a directory.

### Q: What video formats are supported?

A: MP4, AVI, MOV, MKV, and other formats supported by OpenCV.

### Q: How do I deploy to production?

A: See deployment documentation (to be added). Generally:
1. Set `NODE_ENV=production` in `.env`
2. Build frontend: `cd frontend && npm run build`
3. Use a process manager like PM2 for Node.js
4. Configure reverse proxy (nginx)
5. Set up SSL certificates

### Q: How do I reset the database?

A: 
```sql
DROP DATABASE missing_persons;
CREATE DATABASE missing_persons;
\c missing_persons
CREATE EXTENSION postgis;
```
Then run `python scripts/setup_postgres_db.py`

### Q: Where are processed videos stored?

A: Processed videos are saved in `data/results/` directory.

### Q: How do I clear old data?

A: 
- Videos: Delete files from `data/uploads/` and `data/results/`
- Database: Use SQL DELETE statements or reset database

---

## Additional Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [PostGIS Documentation](https://postgis.net/documentation/)
- [YOLOv5 Documentation](https://docs.ultralytics.com/)
- [React Documentation](https://react.dev/)
- [Express.js Documentation](https://expressjs.com/)

---

