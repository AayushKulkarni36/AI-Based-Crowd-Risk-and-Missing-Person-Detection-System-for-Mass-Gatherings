@echo off
setlocal
cd /d "%~dp0"
if not exist "venv\Scripts\activate.bat" (
    echo [ERROR] No virtual environment found at "%~dp0venv".
    echo Run "python -m venv venv" first.
    exit /b 1
)
echo [INFO] Launching Command Prompt with project virtual environment active...
cmd.exe /k "%~dp0venv\Scripts\activate.bat"

