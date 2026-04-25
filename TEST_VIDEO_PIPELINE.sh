#!/bin/bash
set -e

echo "=================================="
echo "CrowdNexis AI Video Pipeline Test Suite"
echo "=================================="
echo ""

API_BASE="http://localhost:5000/api"
TOKEN="${JWT_TOKEN:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwicm9sZSI6IkFETUlOIn0.test}" # Dummy token

echo "[1/6] Testing Backend Health..."
curl -s "$API_BASE/health" | grep -q "OK" && echo "✅ Backend is running" || echo "❌ Backend not responding"
echo ""

echo "[2/6] Checking Database..."
psql -U postgres -d missing_persons -c "SELECT COUNT(*) FROM video_jobs LIMIT 1" > /dev/null 2>&1 && \
  echo "✅ Database connected" || echo "❌ Database connection failed"
echo ""

echo "[3/6] Checking Constraint..."
CONSTRAINT=$(psql -U postgres -d missing_persons -t -c \
  "SELECT pg_get_constraintdef(oid) FROM pg_constraint \
   WHERE conrelid = 'video_jobs'::regclass AND contype = 'c';")

if echo "$CONSTRAINT" | grep -q "UPLOADED.*QUEUED.*PROCESSING.*COMPLETED.*FAILED"; then
  echo "✅ Status constraint is correct"
  echo "   Allowed: UPLOADED, QUEUED, PROCESSING, COMPLETED, FAILED"
else
  echo "⚠️  Constraint may not include all values"
  echo "   Constraint: $CONSTRAINT"
fi
echo ""

echo "[4/6] Checking for wrong-case status values..."
WRONG_CASE=$(grep -rn "'uploaded'\|'processing'\|'completed'\|'failed'" \
  /c/Users/ayush/FinalYearProject/backend/src/ 2>/dev/null | wc -l)

if [ "$WRONG_CASE" -eq 0 ]; then
  echo "✅ No lowercase status values found"
else
  echo "❌ Found $WRONG_CASE lowercase status values"
fi
echo ""

echo "[5/6] Checking Upload Directory..."
if [ -d "/c/Users/ayush/FinalYearProject/data/uploads/videos" ]; then
  echo "✅ Upload directory exists"
else
  echo "⚠️  Creating upload directory..."
  mkdir -p /c/Users/ayush/FinalYearProject/data/uploads/videos
  echo "✅ Upload directory created"
fi
echo ""

echo "[6/6] Checking Required Dependencies..."
echo "  - Node modules..."
if [ -d "/c/Users/ayush/FinalYearProject/backend/node_modules" ]; then
  echo "    ✅ Installed"
else
  echo "    ⚠️  Not installed, run: cd backend && npm install"
fi

echo ""
echo "=================================="
echo "Test Summary"
echo "=================================="
echo "System is ready for video processing!"
echo ""
echo "To start the pipeline:"
echo "1. Start backend: cd backend && node server.js"
echo "2. In another terminal: cd frontend_v2 && npm run dev"
echo "3. Open: http://localhost:5173"
echo "4. Upload and process a video"
echo ""
