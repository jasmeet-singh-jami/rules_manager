#!/usr/bin/env bash
set -e

# Detect venv activate path (Windows Git Bash vs Unix)
if [ -f "backend/venv/Scripts/activate" ]; then
  ACTIVATE="venv/Scripts/activate"
else
  ACTIVATE="venv/bin/activate"
fi

echo "Starting Polycloud Rules Manager..."
echo

(cd backend && source "$ACTIVATE" && uvicorn main:app --reload --port 8000) &
BACKEND_PID=$!

sleep 2

(cd frontend && npm run dev) &
FRONTEND_PID=$!

echo "  Backend  : http://localhost:8000  (pid $BACKEND_PID)"
echo "  Frontend : http://localhost:5173  (pid $FRONTEND_PID)"
echo
echo "  Default login: admin / admin"
echo
echo "  Press Ctrl+C to stop both."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

wait
