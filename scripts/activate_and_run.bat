@echo off
setlocal

cd /d "%~dp0.."

if not exist "venv\Scripts\activate.bat" (
    echo [ERROR] No virtual environment found. Run scripts\install_deps.bat first.
    exit /b 1
)

set SCRIPT=%1
if "%SCRIPT%"=="" (
    set SCRIPT=app_crowd.py
    set PY_ARGS=
) else (
    shift
    set PY_ARGS=%*
)

echo [INFO] Activating virtual environment and running %SCRIPT%...
call venv\Scripts\activate.bat || exit /b 1
python "%SCRIPT%" %PY_ARGS%

if errorlevel 1 (
    echo [ERROR] Script execution failed.
    exit /b 1
) else (
    echo [SUCCESS] Script completed.
)

endlocal

