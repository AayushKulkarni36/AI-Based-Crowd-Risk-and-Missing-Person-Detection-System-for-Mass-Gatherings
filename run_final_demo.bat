@echo off
cd /d C:\Users\ayush\FinalYearProject

echo  PRODUCTION FACE RECOGNITION - 6 FEB READY
echo ==============================================
echo.

REM Install dependencies
echo 1. Installing production dependencies...
pip install ultralytics==8.3.0 facenet-pytorch==2.5.3 pillow scipy --quiet

REM Create demo folder
mkdir data\demo 2>nul

REM Run production demo
echo.
echo 2.  LIVE 30s WEBCAM DEMO STARTING...
echo  Expected: 15-20 FPS | Green=Match Red=Unknown
echo.
python demo_final.py

echo.
echo  6 FEB PRESENTATION COMPLETE!
echo To add yourself: Take photo → data\demo\ayush.jpg → rerun
pause
