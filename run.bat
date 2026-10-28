@echo off
setlocal
title Vision Lab AI
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0run.ps1" %*
set "run_exit=%errorlevel%"
if not "%run_exit%"=="0" (
    echo.
    echo Could not start Vision Lab AI. Read the error above.
    pause
)
exit /b %run_exit%
