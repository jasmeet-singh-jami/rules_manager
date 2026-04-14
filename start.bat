@echo off
echo Starting Polycloud Rules Manager...

start "Backend" cmd /k "cd backend && call venv\Scripts\activate && uvicorn main:app --reload --port 8000"
timeout /t 2 /nobreak > NUL
start "Frontend" cmd /k "cd frontend && npm run dev"

echo Backend: http://localhost:8000
echo Frontend: http://localhost:5173
