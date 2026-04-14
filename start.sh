#!/usr/bin/env bash
set -e

echo "Starting Polycloud Rules Manager..."

(cd backend && source venv/Scripts/activate && uvicorn main:app --reload --port 8000) &
BACKEND_PID=$!

sleep 2

(cd frontend && npm run dev) &
FRONTEND_PID=$!

echo "Backend PID: $BACKEND_PID (http://localhost:8000)"
echo "Frontend PID: $FRONTEND_PID (http://localhost:5173)"
echo "Press Ctrl+C to stop both."

wait
