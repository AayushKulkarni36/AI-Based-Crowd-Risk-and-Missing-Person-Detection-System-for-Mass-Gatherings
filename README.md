# CrowdNexis AI: AI-Based Crowd Risk & Missing Person Detection System

![Status](https://img.shields.io/badge/Status-Production%20Ready-brightgreen)
![Version](https://img.shields.io/badge/Version-1.0.0-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## Project Overview

CrowdNexis AI is an AI-powered system that detects crowd density and identifies missing persons in video feeds. It combines real-time crowd analysis with facial recognition to provide actionable intelligence for public safety operations.

### Key Features

- Real-Time Crowd Detection (YOLO)
- Face Recognition (InsightFace embeddings)
- Live Processing Dashboard with Socket.io
- Missing Persons Database with embedding search
- Alerting and role-based access control
- REST API for uploads, processing, and retrieval

## System Architecture

```
Frontend (Vite + React) ---> Backend (Node.js + Express) ---> PostgreSQL + Redis
                                   |
                                   v
                            Python AI Engine (YOLO, InsightFace, FAISS)
```

## Tech Stack

- Frontend: React, TypeScript, Vite, Tailwind
- Backend: Node.js, Express, PostgreSQL (pgvector), Redis, BullMQ
- Python AI: FastAPI, YOLO, InsightFace, FAISS, OpenCV
- Infrastructure: Docker, Docker Compose

## Prerequisites

- Node.js v18+
- Python 3.9+
- PostgreSQL 15+ with PostGIS
- Git

## Installation

1. Clone the repository

```bash
git clone https://github.com/AayushKulkarni36/AI-Based-Crowd-Risk-and-Missing-Person-Detection-System-for-Mass-Gatherings.git
cd AI-Based-Crowd-Risk-and-Missing-Person-Detection-System-for-Mass-Gatherings
```

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Return to root
cd ..
```

### 3. Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Return to root
cd ..
```

### 4. Python Environment Setup

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows (PowerShell):
.\activate_venv.ps1
# On Windows (Command Prompt):
activate_venv.bat
# On Linux/Mac:
source venv/bin/activate

# Install Python dependencies
pip install --upgrade pip
pip install -r requirements.txt
```

### 5. Database Configuration

#### Install PostgreSQL and PostGIS

1. Install PostgreSQL 15+ from [postgresql.org](https://www.postgresql.org/download/)
2. Install PostGIS extension:
   ```sql
   CREATE EXTENSION postgis;
   ```

#### Create Database

```bash
# Run the setup script
python scripts/setup_postgres_db.py
```

This will:
- Create a database named `missing_persons`
- Enable the PostGIS extension
- Set up necessary tables

### 6. Environment Variables

Create a `.env` file in the project root (copy from `docs/env.example`):

```bash
# Copy the example file
cp docs/env.example .env
```

Edit `.env` and fill in your database credentials:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=missing_persons
DB_USER=postgres
DB_PASSWORD=your_actual_password
PORT=5000
```

<<<<<<< HEAD
** Important**: Never commit `.env` to version control. It contains sensitive credentials.
=======
**Important**: Never commit `.env` to version control. It contains sensitive credentials.
>>>>>>> origin/main

### 7. Download YOLO Model (Optional)

The YOLOv5 model will be automatically downloaded on first use by the Ultralytics library. However, if you want to download it manually:

```bash
# The model will be downloaded to ~/.ultralytics/weights/ automatically
# Or place yolov5s.pt in models/yolo/ directory
```

<<<<<<< HEAD
##  Running the Application
=======
## Running the Application
>>>>>>> origin/main

### Start Backend Server

```bash
cd backend
npm start
```

Backend will run on `http://localhost:5000`

### Start Frontend Development Server

In a new terminal:

```bash
cd frontend
npm run dev
```

Frontend will run on `http://localhost:5173`

### Access the Application

Open your browser and navigate to:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000/api/health

### Quick Start Scripts

Windows users can use the provided batch scripts:

```bash
# Start backend
scripts\run_backend.bat

# Start frontend
scripts\run_frontend.bat

# Start both (requires two terminals)
scripts\start_all.bat
```

<<<<<<< HEAD
##  Project Structure
=======
## Project Structure
>>>>>>> origin/main

```
FinalYearProject/
├── backend/                 # Node.js backend application
│   ├── config/             # Configuration files
│   ├── controllers/        # Route controllers
│   ├── middleware/         # Express middleware
│   ├── routes/             # API routes
│   ├── utils/              # Utility functions
│   └── server.js           # Main server file
│
├── frontend/               # React frontend application
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── services/       # API services
│   │   └── main.jsx        # Entry point
│   ├── index.html
│   └── vite.config.js
│
├── src/                    # Python source code
│   ├── crowd_detection/    # Crowd detection modules
│   ├── face_recognition/   # Face recognition (future)
│   ├── database/           # Database utilities
│   └── utils/              # Python utilities
│
├── scripts/                # Utility scripts
│   ├── setup_postgres_db.py
│   ├── migrate_sqlite_to_postgres.py
│   └── test_postgres_setup.py
│
├── data/                   # Data directories
│   ├── uploads/            # Uploaded videos
│   ├── results/            # Processed results
│   └── outputs/            # Output videos
│
├── models/                 # AI model storage
│   └── yolo/               # YOLO model files
│
├── docs/                   # Documentation
│   ├── SETUP.md            # Detailed setup guide
│   ├── COLLABORATION.md    # Team collaboration guide
│   └── env.example         # Environment template
│
├── config.py               # Python configuration
├── requirements.txt        # Python dependencies
├── .env.example            # Environment template
├── .gitignore              # Git ignore rules
└── README.md               # This file
```

##  Features Implemented (Stage 1)
<<<<<<< HEAD

###  Core Functionality
=======
>>>>>>> origin/main

###  Core Functionality
- **Web Dashboard**: Professional dark-themed UI with navigation
- **Video Analysis**: Upload and process video files for crowd detection
- **Real-Time Detection**: YOLOv5-based person detection (26+ people detected in tests)
- **Risk Classification**: Automatic risk level assessment (Safe/Moderate/Risky/Critical)
- **Missing Person Registry**: CRUD operations for missing person cases
- **Statistics Visualization**: Charts and graphs using Recharts
- **RESTful API**: Complete backend API with error handling
- **Database Integration**: PostgreSQL with connection pooling

###  Analytics Features

- Total people detected
- Average people per frame
- Maximum crowd density
- Risk level distribution
- Time-based statistics

##  Upcoming Features (Stage 2-3)

### Stage 2
- [ ] Face recognition for missing person matching
- [ ] Real-time video stream processing (RTSP support)
- [ ] Email/SMS alert system
- [ ] Advanced analytics and reporting
- [ ] Multi-camera support

### Stage 3
- [ ] Mobile application (React Native)
- [ ] Cloud deployment (AWS/Azure)
- [ ] Machine learning model fine-tuning
- [ ] Historical data analysis
- [ ] Export functionality (PDF/Excel reports)

<<<<<<< HEAD
*

=======


*Add other team members here*

>>>>>>> origin/main
##  Documentation

- **[Setup Guide](docs/SETUP.md)** - Detailed installation and configuration instructions
- **[Collaboration Guide](docs/COLLABORATION.md)** - Git workflow and team collaboration
- **[Team Setup](TEAM_SETUP.md)** - Quick onboarding guide for new team members

<<<<<<< HEAD
##  Testing
=======
## Testing
>>>>>>> origin/main

### Test Database Setup

```bash
python scripts/test_postgres_setup.py
```

### Test Crowd Detection

```bash
python src/crowd_detection/testSimple.py --video path/to/video.mp4
```

### Verify Backend API

```bash
curl http://localhost:5000/api/health
```

##  Troubleshooting

### Common Issues

**Backend won't start:**
- Check if PostgreSQL is running
- Verify `.env` file has correct database credentials
- Ensure port 5000 is not in use

**Frontend won't connect to backend:**
- Verify backend is running on port 5000
- Check CORS settings in `backend/server.js`
- Verify API URL in `frontend/src/services/api.js`

**Python dependencies fail to install:**
- Ensure Python 3.9+ is installed
- Try upgrading pip: `pip install --upgrade pip`
- On Windows, may need Visual C++ Build Tools for some packages

**Database connection errors:**
- Verify PostgreSQL service is running
- Check database credentials in `.env`
- Ensure PostGIS extension is installed

For more detailed troubleshooting, see [docs/SETUP.md](docs/SETUP.md).

<<<<<<< HEAD
## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

##  Contributing
=======
##  License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing
>>>>>>> origin/main

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

See [docs/COLLABORATION.md](docs/COLLABORATION.md) for detailed contribution guidelines.

<<<<<<< HEAD
=======
##  Contact
>>>>>>> origin/main


##  Acknowledgments

- [Ultralytics](https://ultralytics.com/) for YOLOv5 implementation
- [OpenCV](https://opencv.org/) for computer vision tools
- [React](https://react.dev/) and [Vite](https://vitejs.dev/) teams
- All open-source contributors whose libraries made this project possible

---
