@echo off
echo Starting Polycloud Rules Manager...
echo.

start "Backend"  cmd /k "cd backend && call venv\Scripts\activate && uvicorn main:app --reload --port 8000"
timeout /t 2 /nobreak > NUL
start "Frontend" cmd /k "cd frontend && npm run dev"

echo  Backend  : http://localhost:8000
echo  Frontend : http://localhost:5173
echo.
echo  Default login: admin / admin
echo.
echo  Both services started in separate windows. Close them to stop.
