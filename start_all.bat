@echo off
setlocal enabledelayedexpansion
title Vision Lab AI Launcher
echo ========================================================
echo              KHOI DONG VISION LAB AI
echo ========================================================
echo.

echo [1/3] Kiem tra va giai phong port 8000 / 5173 neu dang bi chiem...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000 " ^| findstr "LISTENING"') do (
    echo    - Dung tien trinh cu (PID %%a)
    taskkill /f /pid %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 " ^| findstr "LISTENING"') do (
    echo    - Dung tien trinh cu (PID %%a)
    taskkill /f /pid %%a >nul 2>&1
)

echo.
echo [2/3] Dang khoi dong Backend API (Port 8000)...
start "Vision Lab AI - Backend" cmd /k "backend\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --app-dir backend --reload --reload-dir backend/app"

echo Dang cho Backend ket noi san sang...
set /a retries=0
:wait_backend
ping 127.0.0.1 -n 2 > nul
set /a retries+=1
set http_code=000
for /f %%c in ('curl -s -o nul -w "%%{http_code}" http://127.0.0.1:8000/api/health 2^>nul') do set http_code=%%c
if "!http_code!"=="200" (
    echo    - Backend da san sang sau !retries! giay.
    goto start_frontend
)
if !retries! geq 25 (
    echo    [Canh bao] Backend mat nhieu thoi gian hon du kien, tiep tuc khoi dong frontend...
    goto start_frontend
)
echo    - Dang cho Backend san sang (!retries!s)...
goto wait_backend

:start_frontend
echo.
echo [3/3] Dang khoi dong Frontend (Port 5173)...
start "Vision Lab AI - Frontend" cmd /k "npm --prefix frontend run dev"

echo Dang mo trinh duyet toi http://localhost:5173 ...
ping 127.0.0.1 -n 3 > nul
start http://localhost:5173

echo.
echo ========================================================
echo              VISION LAB AI DA SAN SANG
echo ========================================================
echo   - Backend API:  http://127.0.0.1:8000 (Health: /api/health)
echo   - Frontend App: http://localhost:5173
echo.
echo   * Chu y: De tat toan bo he thong, chay file stop_all.bat
echo ========================================================
echo Cua so nay se tu dong dong sau 10 giay...
ping 127.0.0.1 -n 11 > nul
