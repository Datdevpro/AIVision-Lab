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

@REM  update latest version
@REM  git pull origin main
@REM  npm --prefix frontend ci
@REM  npm --prefix frontend run build
@REM  .\run.bat
