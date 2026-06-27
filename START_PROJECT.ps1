Write-Host ""
Write-Host "========================================"
Write-Host "  CrowdNexis AI - Project Startup"
Write-Host "========================================"
Write-Host ""

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

Write-Host "Checking services..."
Write-Host ""

# Check PostgreSQL
$postgresRunning = (netstat -an | Select-String ":5432").Count -gt 0
if ($postgresRunning) {
    Write-Host "✓ PostgreSQL is running" -ForegroundColor Green
} else {
    Write-Host "❌ PostgreSQL NOT running on port 5432" -ForegroundColor Red
    Write-Host "Please start PostgreSQL first"
    Read-Host "Press Enter to exit"
    exit
}

# Check Redis
$redisRunning = (netstat -an | Select-String ":6379").Count -gt 0
if ($redisRunning) {
    Write-Host "✓ Redis is running" -ForegroundColor Green
} else {
    Write-Host "❌ Redis NOT running on port 6379" -ForegroundColor Red
    Write-Host "Please start Redis (Docker or local)"
    Read-Host "Press Enter to exit"
    exit
}

Write-Host ""
Write-Host "========================================"
Write-Host "Starting 3 Services..."
Write-Host "========================================"
Write-Host ""

Write-Host "[1/3] Starting Python FastAPI Service..."
Start-Process -WindowStyle Normal -FilePath "cmd.exe" -ArgumentList "/k", `
    "cd /d `"$projectRoot`" && venv\Scripts\activate && cd src && python -m uvicorn face_recognition.face_api:app --reload --host 0.0.0.0 --port 8001"

Start-Sleep -Seconds 3

Write-Host "[2/3] Starting Node.js Backend..."
Start-Process -WindowStyle Normal -FilePath "cmd.exe" -ArgumentList "/k", `
    "cd /d `"$projectRoot\backend`" && node server.js"

Start-Sleep -Seconds 2

Write-Host "[3/3] Starting React Frontend..."
Start-Process -WindowStyle Normal -FilePath "cmd.exe" -ArgumentList "/k", `
    "cd /d `"$projectRoot\frontend_v2`" && npm run dev"

Write-Host ""
Write-Host "========================================"
Write-Host "  All Services Started!"
Write-Host "========================================"
Write-Host ""
Write-Host "Services Running:" -ForegroundColor Cyan
Write-Host "  Frontend:     http://localhost:5173"
Write-Host "  Backend API:  http://localhost:5000/api"
Write-Host "  Python AI:    http://localhost:8001"
Write-Host "  PostgreSQL:   localhost:5432 ✓"
Write-Host "  Redis:        localhost:6379 ✓"
Write-Host ""
Write-Host "Demo Credentials:" -ForegroundColor Cyan
Write-Host "  Email:    admin@crowdnexis.ai"
Write-Host "  Password: admin@123"
Write-Host ""
Write-Host "⚠️  Close any terminal window to stop that service"
Write-Host "⚠️  Close ALL windows to stop the entire project"
Write-Host ""
