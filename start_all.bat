@echo off
title Vision Lab AI Launcher
echo ========================================================
echo              STARTING VISION LAB AI
echo ========================================================
echo.
echo 1. Starting Backend (FastAPI on Port 8000)...
start "Vision Lab AI - Backend" cmd /k "backend\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --app-dir backend --reload"

echo 2. Starting Frontend (Vite on Port 5173)...
start "Vision Lab AI - Frontend" cmd /k "npm --prefix frontend run dev"

echo.
echo ========================================================
echo Services started in separate terminal windows:
echo   - Backend API:  http://127.0.0.1:8000
echo   - Frontend App: http://localhost:5173
echo.
echo Open browser at: http://localhost:5173
echo ========================================================
echo Press any key to close this window.
pause > nul
