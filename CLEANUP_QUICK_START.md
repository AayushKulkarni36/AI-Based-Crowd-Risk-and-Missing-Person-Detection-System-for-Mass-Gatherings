# Quick Start Guide - Project Cleanup

## 🚀 Quick Commands

### 1. Preview What Will Be Deleted (Safe - No Changes)
```powershell
.\cleanup_project.ps1 -DryRun
```

### 2. Run Full Cleanup (Deletes Everything)
```powershell
.\cleanup_project.ps1
```

### 3. Cleanup But Keep Virtual Environment
```powershell
.\cleanup_project.ps1 -SkipVenv
```

### 4. Cleanup But Keep Node Modules
```powershell
.\cleanup_project.ps1 -SkipNodeModules
```

### 5. Cleanup But Keep Both Venv and Node Modules
```powershell
.\cleanup_project.ps1 -SkipVenv -SkipNodeModules
```

---

## 📋 What Gets Deleted

### Automatically Deleted:
- ✅ Python cache files (`__pycache__/`, `*.pyc`)
- ✅ Test videos (`data/results/*.avi`, `data/uploads/*.mp4`)
- ✅ Log files (`*.log`)
- ✅ OS files (`.DS_Store`, `Thumbs.db`, `*.tmp`)
- ✅ Editor files (`*.swp`, `*.swo`, `*~`)
- ✅ Backup files (`*.backup`, `*.bak`, `*.old`)
- ✅ Temporary files (`installed_packages.txt`)
- ✅ Duplicate model files (root `yolov5s.pt`, `yolov5su.pt`)

### Optional (Can Skip):
- ⚠️ Virtual environment (`venv/`) - use `-SkipVenv`
- ⚠️ Node modules (`node_modules/`) - use `-SkipNodeModules`

---

## 🔄 After Cleanup - Rebuild If Needed

### If you deleted `venv/`:
```powershell
python -m venv venv
.\activate_venv.ps1
pip install -r requirements.txt
```

### If you deleted `node_modules/`:
```powershell
cd backend
npm install
cd ../frontend
npm install
```

---

## ✅ What's Preserved

- All source code (`src/`, `backend/`, `frontend/`)
- All configuration files (`.json`, `.js`, `.py`, `.env`)
- All scripts (`.bat`, `.ps1`)
- Project structure and folders
- Database files
- Active model files in `backend/`

---

## 📊 Expected Results

- **Space Saved:** 60-80% of project size
- **Time:** 1-5 minutes (depending on disk speed)
- **Risk:** Low (all items can be regenerated)

---

## 🆘 Troubleshooting

**Problem:** Script won't run  
**Solution:** Run PowerShell as Administrator or check execution policy:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**Problem:** Some files couldn't be deleted  
**Solution:** Close any programs using those files (VS Code, Python, Node) and try again

**Problem:** Project doesn't work after cleanup  
**Solution:** Rebuild dependencies (see "After Cleanup" section above)

---

## 📝 Files Created

After running the script, you'll find:
- `cleanup_log_YYYYMMDD_HHMMSS.txt` - Detailed log of all actions
- `cleanup_backup_list_YYYYMMDD_HHMMSS.txt` - List of deleted items

---

**Need more details?** See `CLEANUP_ANALYSIS.md` for comprehensive documentation.

