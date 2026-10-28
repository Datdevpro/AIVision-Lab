@echo off
setlocal
title Vision Lab AI - Setup
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1" %*
set "setup_exit=%errorlevel%"
if not "%setup_exit%"=="0" (
    echo.
    echo Setup failed. Read the error above, fix it, and run setup.bat again.
    pause
)
exit /b %setup_exit%
