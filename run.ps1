<#
.SYNOPSIS
Run the built frontend and backend together on localhost; Ctrl+C stops the server.
.EXAMPLE
.\run.ps1 -Port 8001
#>
[CmdletBinding()]
param(
    [ValidateRange(1, 65535)]
    [int]$Port = 8000,
    [string]$DataDir,
    [switch]$Reload,
    [switch]$CheckOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Push-Location -LiteralPath $PSScriptRoot
try {
    $python = Join-Path $PSScriptRoot 'backend/.venv/Scripts/python.exe'
    if (-not (Test-Path -LiteralPath $python -PathType Leaf)) { throw 'Python environment not found. Run .\setup.bat first.' }
    # Respect an explicit frontend location already supported by the application.
    $frontend = if ($env:VISIONLAB_FRONTEND_DIST) { $env:VISIONLAB_FRONTEND_DIST } else { Join-Path $PSScriptRoot 'frontend/dist' }
    if (-not (Test-Path -LiteralPath (Join-Path $frontend 'index.html') -PathType Leaf)) {
        throw 'Built frontend not found. Run .\setup.bat (or npm --prefix frontend run build) first.'
    }
    if ($DataDir) {
        $dataPath = if ([System.IO.Path]::IsPathRooted($DataDir)) { $DataDir } else { Join-Path $PSScriptRoot $DataDir }
        $env:VISIONLAB_DATA_DIR = [System.IO.Path]::GetFullPath($dataPath)
    }
    $env:PYTHONUTF8 = '1'

    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
    try { $listener.Start() }
    catch { throw "Port $Port is already in use. Close the existing server or run .\run.bat -Port 8001." }
    finally { $listener.Stop() }

    & $python -c "import sys; sys.path.insert(0,'backend'); from app.main import create_app; create_app(); print('Backend imports OK.')"
    if ($LASTEXITCODE -ne 0) { throw 'Backend dependencies are incomplete. Run .\setup.bat again.' }
    if ($CheckOnly) {
        Write-Host "Ready to run on http://localhost:$Port. No server started." -ForegroundColor Green
        exit 0
    }
    Write-Host "Vision Lab AI: http://localhost:$Port" -ForegroundColor Cyan
    Write-Host "API docs:      http://localhost:$Port/docs"
    Write-Host 'Keep this window open. Press Ctrl+C to stop.'
    $arguments = @('-m', 'uvicorn', 'app.main:app', '--app-dir', 'backend', '--host', '127.0.0.1', '--port', "$Port")
    if ($Reload) { $arguments += @('--reload', '--reload-dir', 'backend/app') }
    & $python @arguments
    if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne -1073741510) { throw "Server exited with code $LASTEXITCODE." }
} catch {
    Write-Host "START FAILED: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    Pop-Location
}
