@echo off
echo [INFO] Starting AI Crowd Detection System...
echo.
echo [1/2] Starting Backend Server...
start "Backend Server" cmd /k "cd /d %~dp0..\backend && node server.js"
timeout /t 3 /nobreak >nul
echo [2/2] Starting Frontend Server...
start "Frontend Server" cmd /k "cd /d %~dp0..\frontend && npm run dev"
echo.
echo [SUCCESS] Both servers started!
echo Backend: http://localhost:5000
echo Frontend: http://localhost:3000
echo.
pause
