@echo off
title Vision Lab AI - Dung he thong
echo ========================================================
echo          DANG DUNG HE THONG VISION LAB AI
echo ========================================================
echo.

echo 1. Dang tat Backend tren port 8000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000 " ^| findstr "LISTENING"') do (
    echo    - Dung PID %%a
    taskkill /f /pid %%a >nul 2>&1
)

echo 2. Dang tat Frontend tren port 5173...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 " ^| findstr "LISTENING"') do (
    echo    - Dung PID %%a
    taskkill /f /pid %%a >nul 2>&1
)

echo.
echo ========================================================
echo Tat ca dich vu da duoc tat sach se!
echo ========================================================
ping 127.0.0.1 -n 3 > nul
