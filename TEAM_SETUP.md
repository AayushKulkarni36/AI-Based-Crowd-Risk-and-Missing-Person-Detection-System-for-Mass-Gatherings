# Team Setup Guide

Quick onboarding guide for new team members to get the project running locally.

##  Quick Start Checklist

- [ ] Prerequisites installed
- [ ] Repository cloned
- [ ] Dependencies installed
- [ ] Environment configured
- [ ] Database set up
- [ ] Application running
- [ ] First test successful

---

## Step 1: Prerequisites

Verify you have the following installed:

```bash
# Check Node.js (v18+)
node --version

# Check Python (3.9+)
python --version

# Check PostgreSQL (15+)
psql --version

# Check Git
git --version
```

**Missing something?** See [docs/SETUP.md](docs/SETUP.md) for installation instructions.

---

## Step 2: Clone Repository

```bash
git clone https://github.com/AayushKulkarni36/AI-Based-Crowd-Risk-and-Missing-Person-Detection-System-for-Mass-Gatherings.git
cd AI-Based-Crowd-Risk-and-Missing-Person-Detection-System-for-Mass-Gatherings
```

---

## Step 3: Install Dependencies

### Backend Dependencies

```bash
cd backend
npm install
cd ..
```

### Frontend Dependencies

```bash
cd frontend
npm install
cd ..
```

### Python Dependencies

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows (PowerShell):
.\activate_venv.ps1
# Windows (Command Prompt):
activate_venv.bat
# Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt
```

---

## Step 4: Environment Configuration

### Create .env File

```bash
# Windows
copy docs\env.example .env

# Linux/macOS
cp docs/env.example .env
```

### Edit .env File

Open `.env` and update these values:

```env
# Database Configuration (REQUIRED)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=missing_persons
DB_USER=postgres
DB_PASSWORD=your_actual_password_here

# Application Port (optional, defaults to 5000)
PORT=5000
```

** Important:** Replace `your_actual_password_here` with your PostgreSQL password.

---

## Step 5: Database Setup

### Start PostgreSQL Service

**Windows:**
- Open Services (`services.msc`)
- Find "postgresql" service
- Right-click → Start

**Linux:**
```bash
sudo systemctl start postgresql
```

**macOS:**
```bash
brew services start postgresql@15
```

### Create Database

```bash
python scripts/setup_postgres_db.py
```

This will:
-  Create the `missing_persons` database
-  Enable PostGIS extension
-  Create necessary tables

### Verify Database

```bash
python scripts/test_postgres_setup.py
```

Expected output:
```
 Database connection successful
 PostGIS extension enabled
 Tables created successfully
```

---

## Step 6: Model Download (Automatic)

The YOLOv5 model will be automatically downloaded on first use. No action needed!

If you want to verify:
```python
python -c "from ultralytics import YOLO; model = YOLO('yolov5s.pt')"
```

---

## Step 7: Run the Application

### Terminal 1: Start Backend

```bash
cd backend
npm start
```

You should see:
```
 Backend running on http://localhost:5000
 PostgreSQL connected
```

### Terminal 2: Start Frontend

```bash
cd frontend
npm run dev
```

You should see:
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

### Access the Application

Open your browser:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000/api/health

---

## Step 8: First Test

### Test Backend API

```bash
# Using curl
curl http://localhost:5000/api/health

# Or open in browser
# http://localhost:5000/api/health
```

Expected response:
```json
{
  "status": "OK",
  "message": "Backend running",
  "timestamp": "2025-01-XX..."
}
```

### Test Frontend

1. Open http://localhost:5173
2. You should see the dashboard
3. Navigate through pages:
   - Dashboard
   - Video Analysis
   - Missing Persons
   - Statistics

### Test Video Upload (Optional)

1. Go to "Video Analysis" page
2. Click "Upload Video"
3. Select a test video file
4. Wait for processing
5. View results

---

##  Verification Checklist

Before you start coding, verify:

- [ ] Backend starts without errors
- [ ] Frontend loads in browser
- [ ] Database connection successful
- [ ] API health check returns OK
- [ ] Can navigate all frontend pages
- [ ] No console errors in browser
- [ ] No errors in terminal

---

##  Troubleshooting

### Backend won't start

**Error: "Cannot connect to database"**
- Check PostgreSQL is running
- Verify `.env` has correct credentials
- Test connection: `python scripts/test_postgres_setup.py`

**Error: "Port 5000 already in use"**
- Change `PORT` in `.env` to another port (e.g., 5001)
- Or kill the process using port 5000

### Frontend won't connect

**Error: "Network Error" or "CORS Error"**
- Verify backend is running
- Check backend URL in `frontend/src/services/api.js`
- Ensure CORS is enabled in backend

### Database errors

**Error: "database does not exist"**
- Run: `python scripts/setup_postgres_db.py`

**Error: "password authentication failed"**
- Check `.env` file has correct password
- Verify PostgreSQL user exists

### Python errors

**Error: "No module named 'ultralytics'"**
- Activate virtual environment
- Run: `pip install -r requirements.txt`

**Error: "Microsoft Visual C++ required" (Windows)**
- Install [Visual C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)

---

##  Next Steps

1. **Read Documentation**
   - [README.md](README.md) - Project overview
   - [docs/SETUP.md](docs/SETUP.md) - Detailed setup
   - [docs/COLLABORATION.md](docs/COLLABORATION.md) - Git workflow

2. **Explore the Codebase**
   - `backend/` - Node.js/Express API
   - `frontend/src/` - React components
   - `src/crowd_detection/` - Python AI code

3. **Set Up Git**
   ```bash
   git config user.name "Your Name"
   git config user.email "your.email@example.com"
   ```

4. **Create Your First Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

5. **Start Coding!**
   - Pick an issue from GitHub
   - Create a feature branch
   - Make your changes
   - Submit a Pull Request

---

##  Need Help?

- **Documentation**: Check [docs/](docs/) folder


---


