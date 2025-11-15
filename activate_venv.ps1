Param()

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$activateScript = Join-Path $projectRoot "venv\Scripts\Activate.ps1"

if (-not (Test-Path $activateScript)) {
    Write-Error "No virtual environment found at '$($projectRoot)\venv'. Run 'python -m venv venv' first."
    exit 1
}

Write-Host "[INFO] Launching PowerShell with project virtual environment active..." -ForegroundColor Cyan
powershell -NoExit -ExecutionPolicy Bypass -Command "& { . '$activateScript' }"

