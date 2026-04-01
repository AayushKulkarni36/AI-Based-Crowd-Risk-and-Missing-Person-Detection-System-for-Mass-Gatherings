@echo off
echo Starting Antigravity AI Surveillance System V2...

:: Start Backend
start "Backend API" cmd /k "cd src/face_recognition && python face_api.py"

:: Start Frontend
start "Frontend Dashboard" cmd /k "cd frontend_v2 && npm run dev"

echo System started. Access dashboard: http://localhost:5173
pause
