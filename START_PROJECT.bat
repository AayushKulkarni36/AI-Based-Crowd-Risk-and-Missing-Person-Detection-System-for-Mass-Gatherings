@echo off
REM ============================================================================
REM CrowdSafe - Complete Project Startup Script
REM Starts Python, Backend, and Frontend (PostgreSQL + Redis must be running)
REM ============================================================================

cls
echo.
echo ========================================
echo   CrowdSafe - Project Startup
echo ========================================
echo.

setlocal enabledelayedexpansion
set PROJECT_ROOT=%~dp0
cd /d "%PROJECT_ROOT%"

color 0A

echo Checking services...
echo.

REM Check PostgreSQL
netstat -an | find ":5432" >nul 2>&1
if errorlevel 1 (
    echo ❌ PostgreSQL NOT running on port 5432
    echo Please start PostgreSQL first
    pause
    exit /b 1
) else (
    echo ✓ PostgreSQL is running
)

REM Check Redis
netstat -an | find ":6379" >nul 2>&1
if errorlevel 1 (
    echo ❌ Redis NOT running on port 6379
    echo Please start Redis (Docker or local)
    pause
    exit /b 1
) else (
    echo ✓ Redis is running
)

echo.
echo ========================================
echo Starting 3 Services...
echo ========================================
echo.

echo [1/3] Starting Python FastAPI Service...
start "CrowdSafe - Python AI Engine" cmd /k ^
    cd /d "%PROJECT_ROOT%" && ^
    venv\Scripts\activate && ^
    cd src && ^
    python -m uvicorn face_recognition.face_api:app --reload --host 0.0.0.0 --port 8001

timeout /t 3 /nobreak

echo [2/3] Starting Node.js Backend...
start "CrowdSafe - Node Backend" cmd /k ^
    cd /d "%PROJECT_ROOT%\backend" && ^
    node server.js

timeout /t 2 /nobreak

echo [3/3] Starting React Frontend...
start "CrowdSafe - React Frontend" cmd /k ^
    cd /d "%PROJECT_ROOT%\frontend_v2" && ^
    npm run dev

echo.
echo ========================================
echo   All Services Started!
echo ========================================
echo.
echo Services Running:
echo   Frontend:     http://localhost:5173
echo   Backend API:  http://localhost:5000/api
echo   Python AI:    http://localhost:8001
echo   PostgreSQL:   localhost:5432 ✓
echo   Redis:        localhost:6379 ✓
echo.
echo Demo Credentials:
echo   Email:    admin@crowdsafe.com
echo   Password: admin@123
echo.
echo ⚠️  Close any terminal window to stop that service
echo ⚠️  Close ALL windows to stop the entire project
echo.
pause
