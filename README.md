# AI-Based Crowd Risk and Missing Person Detection System for Mass Gatherings

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python](https://img.shields.io/badge/Python-3.9+-blue.svg)](https://www.python.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-blue.svg)](https://www.postgresql.org/)

A comprehensive AI-powered system for real-time crowd monitoring, risk assessment, and missing person detection in mass gathering scenarios. Built with modern web technologies and state-of-the-art computer vision models.

## Project Overview

This system provides intelligent crowd analysis using YOLOv5 object detection to identify and count people in video feeds, assess crowd density risks, and maintain a registry for missing person cases. The platform features a professional web dashboard for real-time monitoring, video analysis, and data visualization.

### Key Features

- **Real-Time Crowd Detection**: YOLOv5-based person detection with high accuracy
- **Risk Assessment**: Automatic classification of crowd density (Safe/Moderate/Risky/Critical)
- **Video Analysis**: Upload and process video files for crowd analysis
- **Missing Person Registry**: Database management for missing person cases
- **Analytics Dashboard**: Comprehensive statistics and data visualization
- **Professional UI**: Modern dark-themed React interface with Tailwind CSS
- **RESTful API**: Node.js/Express backend with PostgreSQL database

##  Tech Stack

### Frontend
- **React 18** - Modern UI framework
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **Recharts** - Data visualization library
- **React Router** - Client-side routing
- **Axios** - HTTP client

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web application framework
- **PostgreSQL** - Relational database with PostGIS extension
- **Multer** - File upload handling
- **pg** - PostgreSQL client

### AI/ML
- **YOLOv5 (Ultralytics)** - Object detection model
- **OpenCV** - Computer vision library
- **PyTorch** - Deep learning framework
- **NumPy** - Numerical computing

### Database
- **PostgreSQL 15+** - Primary database
- **PostGIS** - Spatial database extension

### Languages
- **Python 3.9+** - AI/ML processing
- **JavaScript (ES6+)** - Frontend and backend

##  System Architecture

```
┌─────────────────┐
│   React Frontend │  (Port 5173)
│   (Vite + Tailwind) │
└────────┬────────┘
         │ HTTP/REST API
         ▼
┌─────────────────┐
│  Node.js Backend │  (Port 5000)
│   (Express.js)   │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐  ┌──────────────┐
│PostgreSQL│  │ Python AI Engine │
│ Database │  │  (YOLOv5 + CV)   │
└────────┘  └──────────────┘
```

### Data Flow

1. **Video Upload**: User uploads video through React frontend
2. **Backend Processing**: Express server receives file and stores in `data/uploads/`
3. **AI Analysis**: Python script processes video using YOLOv5 for person detection
4. **Risk Assessment**: Crowd density calculated and risk level classified
5. **Database Storage**: Results stored in PostgreSQL database
6. **Visualization**: Frontend displays results with charts and statistics

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** v18 or higher ([Download](https://nodejs.org/))
- **Python** 3.9 or higher ([Download](https://www.python.org/))
- **PostgreSQL** 15 or higher with PostGIS extension ([Download](https://www.postgresql.org/download/))
- **Git** ([Download](https://git-scm.com/))
- **npm** or **yarn** (comes with Node.js)

##  Installation

### 1. Clone the Repository

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

**Important**: Never commit `.env` to version control. It contains sensitive credentials.

### 7. Download YOLO Model (Optional)

The YOLOv5 model will be automatically downloaded on first use by the Ultralytics library. However, if you want to download it manually:

```bash
# The model will be downloaded to ~/.ultralytics/weights/ automatically
# Or place yolov5s.pt in models/yolo/ directory
```

## Running the Application

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

## Project Structure

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



*Add other team members here*

## 📚 Documentation

- **[Setup Guide](docs/SETUP.md)** - Detailed installation and configuration instructions
- **[Collaboration Guide](docs/COLLABORATION.md)** - Git workflow and team collaboration
- **[Team Setup](TEAM_SETUP.md)** - Quick onboarding guide for new team members

## Testing

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

##  License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

See [docs/COLLABORATION.md](docs/COLLABORATION.md) for detailed contribution guidelines.

##  Contact

For questions, issues, or contributions, please:
- Open an issue on GitHub
- Contact the project maintainer

##  Acknowledgments

- [Ultralytics](https://ultralytics.com/) for YOLOv5 implementation
- [OpenCV](https://opencv.org/) for computer vision tools
- [React](https://react.dev/) and [Vite](https://vitejs.dev/) teams
- All open-source contributors whose libraries made this project possible

---
