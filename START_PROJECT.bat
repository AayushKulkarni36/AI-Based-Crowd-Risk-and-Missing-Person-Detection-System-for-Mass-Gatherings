@echo off
setlocal enabledelayedexpansion

REM ============================================================================
REM CrowdNexis AI - One-command startup (Windows)
REM - Starts Docker (Postgres + Redis)
REM - Ensures DB + migrations exist
REM - Creates venv + installs python deps if missing
REM - Installs backend/frontend deps if missing
REM - Starts backend + frontend in separate windows
REM ============================================================================

cls
color 0A

set "PROJECT_ROOT=%~dp0"
cd /d "%PROJECT_ROOT%"

echo ========================================
echo   CrowdNexis AI - One Command Startup
echo ========================================
echo Project: %PROJECT_ROOT%
echo.

REM --- Check Docker -----------------------------------------------------------
where docker >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Docker CLI not found. Install Docker Desktop first.
  pause
  exit /b 1
)

docker info >nul 2>&1
if errorlevel 1 (
  echo [WARN] Docker daemon not reachable. Trying to start Docker Desktop...
  if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" (
    start "" "%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
  ) else if exist "%ProgramFiles(x86)%\Docker\Docker\Docker Desktop.exe" (
    start "" "%ProgramFiles(x86)%\Docker\Docker\Docker Desktop.exe"
  ) else (
    echo [ERROR] Docker Desktop not found. Please start Docker manually.
    pause
    exit /b 1
  )

  echo [INFO] Waiting for Docker to be ready...
  for /l %%i in (1,1,60) do (
    docker info >nul 2>&1 && goto :docker_ready
    timeout /t 2 /nobreak >nul
  )
  echo [ERROR] Docker did not become ready in time.
  pause
  exit /b 1
)
:docker_ready
echo [OK] Docker is running.
echo.

REM --- Start Postgres + Redis containers -------------------------------------
set "PG_CONTAINER="
set "REDIS_CONTAINER="

for /f "usebackq delims=" %%c in (`docker ps -a --format "{{.Names}}"`) do (
  if /i "%%c"=="healthcare_db" set "PG_CONTAINER=healthcare_db"
  if /i "%%c"=="crowdnexis_ai-db" set "PG_CONTAINER=crowdnexis_ai-db"
  if /i "%%c"=="crowdnexis_ai-redis" set "REDIS_CONTAINER=crowdnexis_ai-redis"
  if /i "%%c"=="redis" set "REDIS_CONTAINER=redis"
)

if not defined PG_CONTAINER (
  echo [INFO] No known Postgres container found.
  echo [INFO] Trying: docker compose up -d db redis
  docker compose up -d db redis
  if errorlevel 1 (
    echo [ERROR] docker compose failed. If your compose image tag is invalid, fix docker-compose.yml or create a Postgres container.
    pause
    exit /b 1
  )
  set "PG_CONTAINER=crowdnexis_ai-db"
  set "REDIS_CONTAINER=crowdnexis_ai-redis"
) else (
  echo [INFO] Starting Postgres container: %PG_CONTAINER%
  docker start %PG_CONTAINER% >nul 2>&1
  if errorlevel 1 (
    echo [ERROR] Failed to start Postgres container: %PG_CONTAINER%
    pause
    exit /b 1
  )
)

if defined REDIS_CONTAINER (
  echo [INFO] Starting Redis container: %REDIS_CONTAINER%
  docker start %REDIS_CONTAINER% >nul 2>&1
) else (
  echo [INFO] No known Redis container found. Trying docker compose redis...
  docker compose up -d redis
)

echo [INFO] Waiting for ports 5432 (Postgres) and 6379 (Redis)...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$deadline=(Get-Date).AddMinutes(2); " ^
  "while((Get-Date) -lt $deadline){" ^
  "  $pg = (Test-NetConnection -ComputerName localhost -Port 5432 -WarningAction SilentlyContinue).TcpTestSucceeded; " ^
  "  $rd = (Test-NetConnection -ComputerName localhost -Port 6379 -WarningAction SilentlyContinue).TcpTestSucceeded; " ^
  "  if($pg -and $rd){ exit 0 }; Start-Sleep -Seconds 2" ^
  "} exit 1"
if errorlevel 1 (
  echo [ERROR] Postgres/Redis ports are not ready.
  pause
  exit /b 1
)
echo [OK] Postgres + Redis ports ready.
echo.

REM --- Ensure DB + migrate ----------------------------------------------------
echo [INFO] Ensuring database 'missing_persons' exists...

for /f "usebackq delims=" %%x in (`docker exec %PG_CONTAINER% psql -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='missing_persons';" 2^>nul`) do set "DB_EXISTS=%%x"
if not defined DB_EXISTS (
  docker exec %PG_CONTAINER% psql -U postgres -d postgres -c "CREATE DATABASE missing_persons;" >nul 2>&1
)

echo [INFO] Applying DB migrations (backend/migrate.sql)...
docker cp "%PROJECT_ROOT%backend\migrate.sql" %PG_CONTAINER%:/tmp/migrate.sql >nul 2>&1
docker exec %PG_CONTAINER% psql -U postgres -d missing_persons -f /tmp/migrate.sql >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Migration failed.
  echo Tip: open another terminal and run:
  echo   docker exec -it %PG_CONTAINER% psql -U postgres -d missing_persons
  pause
  exit /b 1
)
echo [OK] DB ready.
echo.

REM --- Python venv + deps -----------------------------------------------------
if not exist "%PROJECT_ROOT%venv\Scripts\python.exe" (
  echo [INFO] Creating Python virtual environment...
  python -m venv venv
  if errorlevel 1 (
    echo [ERROR] Failed to create venv. Ensure Python is installed and on PATH.
    pause
    exit /b 1
  )
)

echo [INFO] Installing Python dependencies (requirements.txt)...
call "%PROJECT_ROOT%venv\Scripts\python.exe" -m pip install --upgrade pip >nul 2>&1
call "%PROJECT_ROOT%venv\Scripts\pip.exe" install -r "%PROJECT_ROOT%requirements.txt"
if errorlevel 1 (
  echo [ERROR] Python dependency install failed.
  pause
  exit /b 1
)
echo [OK] Python deps installed.
echo.

REM --- Node deps --------------------------------------------------------------
if not exist "%PROJECT_ROOT%backend\node_modules" (
  echo [INFO] Installing backend npm dependencies...
  pushd "%PROJECT_ROOT%backend"
  call npm install
  popd
)

if not exist "%PROJECT_ROOT%frontend_v2\node_modules" (
  echo [INFO] Installing frontend npm dependencies...
  pushd "%PROJECT_ROOT%frontend_v2"
  call npm install
  popd
)

REM --- Start services ---------------------------------------------------------
echo ========================================
echo Starting Backend + Frontend...
echo ========================================
echo.

REM Kill anything already using ports (best-effort)
for /f "tokens=5" %%p in ('netstat -ano ^| findstr :5000 ^| findstr LISTENING') do (
  taskkill /PID %%p /F >nul 2>&1
)
for /f "tokens=5" %%p in ('netstat -ano ^| findstr :5173 ^| findstr LISTENING') do (
  taskkill /PID %%p /F >nul 2>&1
)

start "CrowdNexis AI - Backend (Node)" /D "%PROJECT_ROOT%backend" cmd /k npm start

timeout /t 2 /nobreak >nul

start "CrowdNexis AI - Python AI Service" cmd /k "cd /d "%PROJECT_ROOT%" && venv\Scripts\activate && cd src && python -m uvicorn face_recognition.face_api:app --reload --host 0.0.0.0 --port 8001"

timeout /t 2 /nobreak >nul

start "CrowdNexis AI - Frontend (Vite)" /D "%PROJECT_ROOT%frontend_v2" cmd /k npm run dev

echo.
echo ========================================
echo   All 3 Services Started!
echo ========================================
echo.
echo   Frontend  : http://localhost:5173
echo   Backend   : http://localhost:5000/api/health
echo   Python AI : http://localhost:8001/docs
echo.
echo   Admin Login    : admin@crowdsafe.com  /  Admin@123
echo   Operator Login : operator@crowdnexis.ai  /  operator123
echo.
echo   Close any terminal window to stop that service.
echo ========================================
echo.
pause
