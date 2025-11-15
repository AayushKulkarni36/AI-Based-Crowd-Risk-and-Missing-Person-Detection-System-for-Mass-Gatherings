@echo off
setlocal

REM Ensure we run from project root
cd /d "%~dp0.."

if not exist "venv\Scripts\python.exe" (
    echo [INFO] No virtual environment detected. Creating one now...
    python -m venv venv || exit /b 1
)

echo [INFO] Upgrading pip...
call venv\Scripts\python.exe -m pip install --upgrade pip || exit /b 1

echo [INFO] Installing dependencies from requirements.txt...
call venv\Scripts\pip.exe install -r requirements.txt || exit /b 1

echo [SUCCESS] Dependencies installed in %cd%\venv
endlocal

