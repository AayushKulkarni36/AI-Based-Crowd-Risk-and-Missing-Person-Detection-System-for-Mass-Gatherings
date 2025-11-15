# ============================================================================
# FinalYearProject Cleanup Script
# ============================================================================
# This script analyzes and removes unnecessary files/folders from the project
# while preserving all essential code and configuration files.
# ============================================================================

param(
    [switch]$DryRun = $false,
    [switch]$SkipConfirmation = $false,
    [switch]$SkipVenv = $false,
    [switch]$SkipNodeModules = $false
)

$ErrorActionPreference = "Continue"
$ProjectRoot = $PSScriptRoot
$LogFile = Join-Path $ProjectRoot "cleanup_log_$(Get-Date -Format 'yyyyMMdd_HHmmss').txt"
$BackupListFile = Join-Path $ProjectRoot "cleanup_backup_list_$(Get-Date -Format 'yyyyMMdd_HHmmss').txt"

# Colors for output
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

function Write-Header($text) {
    Write-ColorOutput Cyan "`n═══════════════════════════════════════════════════════════"
    Write-ColorOutput Cyan $text
    Write-ColorOutput Cyan "═══════════════════════════════════════════════════════════`n"
}

function Write-Section($text) {
    Write-ColorOutput Yellow "`n──────────────────────────────────────────────────────────"
    Write-ColorOutput Yellow $text
    Write-ColorOutput Yellow "──────────────────────────────────────────────────────────`n"
}

function Get-FolderSize($path) {
    if (-not (Test-Path $path)) { return 0 }
    try {
        $size = (Get-ChildItem -Path $path -Recurse -ErrorAction SilentlyContinue | 
                 Measure-Object -Property Length -Sum -ErrorAction SilentlyContinue).Sum
        return [math]::Round($size / 1MB, 2)
    } catch {
        return 0
    }
}

function Get-FileSize($path) {
    if (-not (Test-Path $path)) { return 0 }
    try {
        $size = (Get-Item $path -ErrorAction SilentlyContinue).Length
        return [math]::Round($size / 1MB, 2)
    } catch {
        return 0
    }
}

function Format-Size($sizeMB) {
    if ($sizeMB -ge 1024) {
        return "{0:N2} GB" -f ($sizeMB / 1024)
    } else {
        return "{0:N2} MB" -f $sizeMB
    }
}

function Remove-ItemSafely($path, $description) {
    if (-not (Test-Path $path)) {
        Write-Output "  [SKIP] $description - Not found" | Tee-Object -FilePath $LogFile -Append
        return $false
    }
    
    try {
        if ($DryRun) {
            Write-ColorOutput Gray "  [DRY RUN] Would delete: $path"
            Write-Output "[DRY RUN] Would delete: $path" | Tee-Object -FilePath $LogFile -Append
            return $true
        } else {
            Remove-Item -Path $path -Recurse -Force -ErrorAction Stop
            Write-ColorOutput Green "  [OK] Deleted: $description"
            Write-Output "[DELETED] $path" | Tee-Object -FilePath $LogFile -Append
            return $true
        }
    } catch {
        Write-ColorOutput Red "  [ERROR] Failed to delete: $description - $($_.Exception.Message)"
        Write-Output "[ERROR] Failed to delete: $path - $($_.Exception.Message)" | Tee-Object -FilePath $LogFile -Append
        return $false
    }
}

# Initialize log file
Write-Output "FinalYearProject Cleanup Log - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Out-File $LogFile
Write-Output "Project Root: $ProjectRoot" | Out-File $LogFile -Append
Write-Output "Dry Run: $DryRun" | Out-File $LogFile -Append
Write-Output "=" * 80 | Out-File $LogFile -Append

Write-Header "FINALYEARPROJECT CLEANUP SCRIPT"

# ============================================================================
# PHASE 1: ANALYSIS
# ============================================================================
Write-Section "PHASE 1: ANALYZING PROJECT STRUCTURE"

$itemsToDelete = @{
    PythonCache = @()
    NodeModules = @()
    BuildArtifacts = @()
    TempData = @()
    LogFiles = @()
    OSFiles = @()
    EditorFiles = @()
    BackupFiles = @()
    TestArtifacts = @()
    DuplicateFiles = @()
    VirtualEnv = @()
    ModelFiles = @()
}

$totalSizeMB = 0

# 1. Python Cache Files
Write-Output "Scanning for Python cache files..."
Get-ChildItem -Path $ProjectRoot -Recurse -Directory -Filter "__pycache__" -ErrorAction SilentlyContinue | 
    Where-Object { $_.FullName -notlike "*\venv\*" } | ForEach-Object {
        $size = Get-FolderSize $_.FullName
        $itemsToDelete.PythonCache += @{
            Path = $_.FullName
            Size = $size
            Description = "Python cache: $($_.FullName.Replace($ProjectRoot, '.'))"
        }
        $totalSizeMB += $size
    }

Get-ChildItem -Path $ProjectRoot -Recurse -Filter "*.pyc" -ErrorAction SilentlyContinue | 
    Where-Object { $_.FullName -notlike "*\venv\*" } | ForEach-Object {
        $size = Get-FileSize $_.FullName
        $itemsToDelete.PythonCache += @{
            Path = $_.FullName
            Size = $size
            Description = "Python bytecode: $($_.FullName.Replace($ProjectRoot, '.'))"
        }
        $totalSizeMB += $size
    }

Get-ChildItem -Path $ProjectRoot -Recurse -Filter "*.pyo" -ErrorAction SilentlyContinue | 
    Where-Object { $_.FullName -notlike "*\venv\*" } | ForEach-Object {
        $size = Get-FileSize $_.FullName
        $itemsToDelete.PythonCache += @{
            Path = $_.FullName
            Size = $size
            Description = "Python optimized: $($_.FullName.Replace($ProjectRoot, '.'))"
        }
        $totalSizeMB += $size
    }

Get-ChildItem -Path $ProjectRoot -Recurse -Directory -Filter ".pytest_cache" -ErrorAction SilentlyContinue | ForEach-Object {
    $size = Get-FolderSize $_.FullName
    $itemsToDelete.PythonCache += @{
        Path = $_.FullName
        Size = $size
        Description = "Pytest cache: $($_.FullName.Replace($ProjectRoot, '.'))"
    }
    $totalSizeMB += $size
}

# 2. Node Modules
if (-not $SkipNodeModules) {
    Write-Output "Scanning for node_modules..."
    @("backend\node_modules", "frontend\node_modules") | ForEach-Object {
        $path = Join-Path $ProjectRoot $_
        if (Test-Path $path) {
            $size = Get-FolderSize $path
            $itemsToDelete.NodeModules += @{
                Path = $path
                Size = $size
                Description = "Node modules: $_"
            }
            $totalSizeMB += $size
        }
    }
}

# 3. Build Artifacts
Write-Output "Scanning for build artifacts..."
@("backend\dist", "frontend\dist", "frontend\build") | ForEach-Object {
    $path = Join-Path $ProjectRoot $_
    if (Test-Path $path) {
        $size = Get-FolderSize $path
        $itemsToDelete.BuildArtifacts += @{
            Path = $path
            Size = $size
            Description = "Build artifact: $_"
        }
        $totalSizeMB += $size
    }
}

# 4. Temporary Data Files
Write-Output "Scanning for temporary data files..."
# Processed result videos
$resultsPath = Join-Path $ProjectRoot "data\results"
if (Test-Path $resultsPath) {
    Get-ChildItem -Path $resultsPath -Filter "result_*.avi" -ErrorAction SilentlyContinue | ForEach-Object {
        $size = Get-FileSize $_.FullName
        $itemsToDelete.TempData += @{
            Path = $_.FullName
            Size = $size
            Description = "Processed video: $($_.Name)"
        }
        $totalSizeMB += $size
    }
}

# Uploaded test videos
$uploadsPath = Join-Path $ProjectRoot "data\uploads"
if (Test-Path $uploadsPath) {
    Get-ChildItem -Path $uploadsPath -Filter "*.mp4" -ErrorAction SilentlyContinue | ForEach-Object {
        $size = Get-FileSize $_.FullName
        $itemsToDelete.TempData += @{
            Path = $_.FullName
            Size = $size
            Description = "Test upload: $($_.Name)"
        }
        $totalSizeMB += $size
    }
}

# 5. Log Files
Write-Output "Scanning for log files..."
Get-ChildItem -Path $ProjectRoot -Recurse -Filter "*.log" -ErrorAction SilentlyContinue | 
    Where-Object { $_.FullName -notlike "*\venv\*" -and $_.FullName -notlike "*\node_modules\*" } | ForEach-Object {
        $size = Get-FileSize $_.FullName
        $itemsToDelete.LogFiles += @{
            Path = $_.FullName
            Size = $size
            Description = "Log file: $($_.FullName.Replace($ProjectRoot, '.'))"
        }
        $totalSizeMB += $size
    }

# 6. OS Files
Write-Output "Scanning for OS-generated files..."
@(".DS_Store", "Thumbs.db", "desktop.ini") | ForEach-Object {
    Get-ChildItem -Path $ProjectRoot -Recurse -Filter $_ -ErrorAction SilentlyContinue | 
        Where-Object { $_.FullName -notlike "*\venv\*" -and $_.FullName -notlike "*\node_modules\*" } | ForEach-Object {
            $size = Get-FileSize $_.FullName
            $itemsToDelete.OSFiles += @{
                Path = $_.FullName
                Size = $size
                Description = "OS file: $($_.FullName.Replace($ProjectRoot, '.'))"
            }
            $totalSizeMB += $size
        }
}

Get-ChildItem -Path $ProjectRoot -Recurse -Filter "*.tmp" -ErrorAction SilentlyContinue | 
    Where-Object { $_.FullName -notlike "*\venv\*" -and $_.FullName -notlike "*\node_modules\*" } | ForEach-Object {
        $size = Get-FileSize $_.FullName
        $itemsToDelete.OSFiles += @{
            Path = $_.FullName
            Size = $size
            Description = "Temp file: $($_.FullName.Replace($ProjectRoot, '.'))"
        }
        $totalSizeMB += $size
    }

# 7. Editor Files
Write-Output "Scanning for editor files..."
@("*.swp", "*.swo", "*~") | ForEach-Object {
    Get-ChildItem -Path $ProjectRoot -Recurse -Filter $_ -ErrorAction SilentlyContinue | 
        Where-Object { $_.FullName -notlike "*\venv\*" -and $_.FullName -notlike "*\node_modules\*" } | ForEach-Object {
            $size = Get-FileSize $_.FullName
            $itemsToDelete.EditorFiles += @{
                Path = $_.FullName
                Size = $size
                Description = "Editor file: $($_.FullName.Replace($ProjectRoot, '.'))"
            }
            $totalSizeMB += $size
        }
}

# 8. Backup Files
Write-Output "Scanning for backup files..."
@("*.backup", "*.bak", "*.old") | ForEach-Object {
    Get-ChildItem -Path $ProjectRoot -Recurse -Filter $_ -ErrorAction SilentlyContinue | 
        Where-Object { $_.FullName -notlike "*\venv\*" -and $_.FullName -notlike "*\node_modules\*" } | ForEach-Object {
            $size = Get-FileSize $_.FullName
            $itemsToDelete.BackupFiles += @{
                Path = $_.FullName
                Size = $size
                Description = "Backup file: $($_.FullName.Replace($ProjectRoot, '.'))"
            }
            $totalSizeMB += $size
        }
}

# 9. Test Artifacts
Write-Output "Scanning for test artifacts..."
@("test_output.avi", "output_*.mp4", "sample_*.mp4") | ForEach-Object {
    Get-ChildItem -Path $ProjectRoot -Recurse -Filter $_ -ErrorAction SilentlyContinue | 
        Where-Object { $_.FullName -notlike "*\venv\*" -and $_.FullName -notlike "*\node_modules\*" } | ForEach-Object {
            $size = Get-FileSize $_.FullName
            $itemsToDelete.TestArtifacts += @{
                Path = $_.FullName
                Size = $size
                Description = "Test artifact: $($_.FullName.Replace($ProjectRoot, '.'))"
            }
            $totalSizeMB += $size
        }
}

# 10. Duplicate/Temporary Files
Write-Output "Scanning for duplicate/temporary files..."
$tempFiles = @(
    "installed_packages.txt"
)

foreach ($file in $tempFiles) {
    $path = Join-Path $ProjectRoot $file
    if (Test-Path $path) {
        $size = Get-FileSize $path
        $itemsToDelete.DuplicateFiles += @{
            Path = $path
            Size = $size
            Description = "Temporary file: $file"
        }
        $totalSizeMB += $size
    }
}

# 11. Virtual Environment (optional)
if (-not $SkipVenv) {
    Write-Output "Scanning for virtual environment..."
    $venvPath = Join-Path $ProjectRoot "venv"
    if (Test-Path $venvPath) {
        $size = Get-FolderSize $venvPath
        $itemsToDelete.VirtualEnv += @{
            Path = $venvPath
            Size = $size
            Description = "Virtual environment (can be recreated with: python -m venv venv)"
        }
        $totalSizeMB += $size
    }
}

# 12. Model Files (duplicates - keep backend/yolov5su.pt)
Write-Output "Scanning for duplicate model files..."
$modelFiles = @(
    "yolov5s.pt",
    "yolov5su.pt"
)

foreach ($file in $modelFiles) {
    $path = Join-Path $ProjectRoot $file
    if (Test-Path $path) {
        $size = Get-FileSize $path
        $itemsToDelete.ModelFiles += @{
            Path = $path
            Size = $size
            Description = "Model file (ultralytics auto-downloads if needed): $file"
        }
        $totalSizeMB += $size
    }
}

# ============================================================================
# PHASE 2: GENERATE REPORT
# ============================================================================
Write-Section "PHASE 2: CLEANUP REPORT"

$report = @"
═══════════════════════════════════════════════════════════
FINALYEARPROJECT CLEANUP REPORT
═══════════════════════════════════════════════════════════
Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
Project Root: $ProjectRoot

"@

$categoryCount = 0
$categorySizes = @{}

foreach ($category in $itemsToDelete.Keys) {
    $items = $itemsToDelete[$category]
    if ($items.Count -gt 0) {
        $categoryCount++
        $categorySize = ($items | Measure-Object -Property Size -Sum).Sum
        $categorySizes[$category] = $categorySize
        
        $report += "`n[$category] - $(Format-Size $categorySize) ($($items.Count) items)`n"
        $report += "-" * 60 + "`n"
        
        foreach ($item in $items) {
            $report += "  • $($item.Description) - $(Format-Size $item.Size)`n"
        }
    }
}

$report += "`n" + "=" * 60 + "`n"
$report += "TOTAL ITEMS TO DELETE: $(($itemsToDelete.Values | ForEach-Object { $_.Count } | Measure-Object -Sum).Sum)`n"
$report += "TOTAL SPACE TO FREE: $(Format-Size $totalSizeMB)`n"
$report += "=" * 60 + "`n"

Write-Output $report
$report | Out-File $BackupListFile

# ============================================================================
# PHASE 3: CONFIRMATION
# ============================================================================
if (-not $SkipConfirmation) {
    Write-Section "PHASE 3: CONFIRMATION REQUIRED"
    
    if ($DryRun) {
        Write-ColorOutput Yellow "DRY RUN MODE - No files will be deleted"
    } else {
        Write-ColorOutput Red "WARNING: This will permanently delete the files listed above!"
        Write-ColorOutput Yellow "A backup list has been saved to: $BackupListFile"
    }
    
    $response = Read-Host "`nDo you want to proceed? (yes/no)"
    if ($response -ne "yes" -and $response -ne "y") {
        Write-ColorOutput Yellow "`nCleanup cancelled by user."
        exit 0
    }
}

# ============================================================================
# PHASE 4: EXECUTION
# ============================================================================
Write-Section "PHASE 4: EXECUTING CLEANUP"

$deletedCount = 0
$failedCount = 0
$freedSpace = 0

foreach ($category in $itemsToDelete.Keys) {
    $items = $itemsToDelete[$category]
    if ($items.Count -gt 0) {
        Write-Output "`nProcessing category: $category"
        foreach ($item in $items) {
            if (Remove-ItemSafely -path $item.Path -description $item.Description) {
                $deletedCount++
                $freedSpace += $item.Size
            } else {
                $failedCount++
            }
        }
    }
}

# ============================================================================
# PHASE 5: SUMMARY
# ============================================================================
Write-Section "PHASE 5: CLEANUP SUMMARY"

$summary = @"
═══════════════════════════════════════════════════════════
CLEANUP COMPLETED
═══════════════════════════════════════════════════════════
Items Deleted: $deletedCount
Items Failed:  $failedCount
Space Freed:   $(Format-Size $freedSpace)
Log File:      $LogFile
Backup List:   $BackupListFile
═══════════════════════════════════════════════════════════
"@

Write-Output $summary
$summary | Out-File $LogFile -Append

if ($DryRun) {
    Write-ColorOutput Cyan "`nThis was a DRY RUN. No files were actually deleted."
    Write-ColorOutput Cyan "Run without -DryRun to perform actual cleanup."
} else {
    Write-ColorOutput Green "`nCleanup completed successfully!"
    Write-ColorOutput Yellow "`nNext steps:"
    Write-Output "  1. Recreate virtual environment: python -m venv venv"
    Write-Output "  2. Install Python dependencies: venv\Scripts\pip install -r requirements.txt"
    Write-Output "  3. Install Node dependencies:"
    Write-Output "     - Backend: cd backend && npm install"
    Write-Output "     - Frontend: cd frontend && npm install"
    Write-Output "  4. Test the project to ensure everything works"
}

Write-Output "`n"

