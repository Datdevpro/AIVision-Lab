<#
.SYNOPSIS
Install Vision Lab AI on Windows after cloning the repository.
.EXAMPLE
.\setup.ps1
.EXAMPLE
.\setup.ps1 -Torch cu128 -PrefetchFlowers
.EXAMPLE
.\setup.ps1 -PythonPath 'C:\Python312\python.exe' -IncludeTests
#>
[CmdletBinding()]
param(
    [ValidateSet('cpu', 'cu124', 'cu126', 'cu128', 'cu130')]
    [string]$Torch = 'cpu',
    [string]$PythonPath,
    [switch]$SkipWeights,
    [switch]$PrefetchFlowers,
    [switch]$IncludeTests,
    [switch]$CheckOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Invoke-Checked {
    param([string]$Executable, [string[]]$Arguments)
    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed (exit $LASTEXITCODE): $Executable $($Arguments -join ' ')"
    }
}

function Get-PythonInfo {
    param([string]$Executable, [string[]]$Prefix = @())
    # Missing versions in the Windows launcher write to stderr; try the next candidate.
    $ErrorActionPreference = 'Continue'
    try {
        $probe = "import json,struct,sys; print(json.dumps({'version':sys.version.split()[0],'bits':struct.calcsize('P')*8,'supported':sys.version_info[:2] in [(3,11),(3,12)]}))"
        $output = & $Executable @Prefix -c $probe 2>$null
        if ($LASTEXITCODE -eq 0) {
            $info = ($output -join "`n") | ConvertFrom-Json
            if ($info.supported -and $info.bits -eq 64) {
                return [pscustomobject]@{ Executable = $Executable; Prefix = $Prefix; Version = $info.version }
            }
        }
    } catch { return $null }
    return $null
}

function Find-Python {
    if ($PythonPath) {
        $command = Get-Command -Name $PythonPath -CommandType Application -ErrorAction SilentlyContinue
        if ($command) {
            $result = Get-PythonInfo -Executable $command.Source
            if ($result) { return $result }
        }
        throw 'PythonPath must point to a working 64-bit Python 3.11 or 3.12 executable.'
    }
    $launcher = Get-Command py.exe -CommandType Application -ErrorAction SilentlyContinue
    if ($launcher) {
        foreach ($version in @('-3.12', '-3.11')) {
            $result = Get-PythonInfo -Executable $launcher.Source -Prefix @($version)
            if ($result) { return $result }
        }
    }
    foreach ($name in @('python.exe', 'python3.exe')) {
        $command = Get-Command $name -CommandType Application -ErrorAction SilentlyContinue
        if ($command -and $command.Source -notlike '*\Microsoft\WindowsApps\*') {
            $result = Get-PythonInfo -Executable $command.Source
            if ($result) { return $result }
        }
    }
    throw 'Install 64-bit Python 3.12 from https://www.python.org/downloads/windows/ (enable Python launcher and PATH), reopen the terminal, then retry. Python 3.11 is also supported.'
}

Push-Location -LiteralPath $PSScriptRoot
try {
    Write-Host '=== Vision Lab AI - Windows setup ===' -ForegroundColor Cyan
    if ($env:OS -ne 'Windows_NT') { throw 'This script targets Windows. See README.md for the manual install commands.' }
    foreach ($required in @('backend/requirements.txt', 'frontend/package-lock.json', 'backend/scripts/prepare_install.py')) {
        if (-not (Test-Path -LiteralPath $required -PathType Leaf)) { throw "Missing $required. Run setup from a complete clone of this repository." }
    }
    $basePython = Find-Python
    Write-Host "Python $($basePython.Version) (64-bit): $($basePython.Executable)"

    $node = Get-Command node.exe -CommandType Application -ErrorAction SilentlyContinue
    $npm = Get-Command npm.cmd -CommandType Application -ErrorAction SilentlyContinue
    if (-not $node -or -not $npm) {
        throw 'Install Node.js 24 LTS (with npm) from https://nodejs.org/, reopen the terminal, then retry.'
    }
    $nodeVersion = & $node.Source --version
    if ($LASTEXITCODE -ne 0 -or $nodeVersion -notmatch '^v(\d+)\.') { throw 'Could not read the Node.js version.' }
    if ([int]$Matches[1] -lt 24) { throw "Node.js 24 or later is required; found $nodeVersion. Install Node.js 24 LTS and retry." }
    Write-Host "Node.js $nodeVersion; npm: $($npm.Source)"
    Write-Host "PyTorch package index: https://download.pytorch.org/whl/$Torch"

    $venvDirectory = Join-Path $PSScriptRoot 'backend/.venv'
    $venvPython = Join-Path $venvDirectory 'Scripts/python.exe'
    if (Test-Path -LiteralPath $venvDirectory) {
        $venvInfo = $null
        if (Test-Path -LiteralPath $venvPython -PathType Leaf) { $venvInfo = Get-PythonInfo -Executable $venvPython }
        if (-not $venvInfo) {
            throw 'backend/.venv is incomplete or belongs to another machine. Rename that folder and rerun setup. Do not copy .venv between machines; keep backend/data.'
        }
        Write-Host "Reusing backend/.venv (Python $($venvInfo.Version))."
    }
    if ($CheckOnly) {
        Write-Host 'Prerequisites OK. CheckOnly did not install or modify anything.' -ForegroundColor Green
        exit 0
    }

    if (-not (Test-Path -LiteralPath $venvPython -PathType Leaf)) {
        Write-Host '[1/5] Creating backend/.venv...' -ForegroundColor Yellow
        Invoke-Checked -Executable $basePython.Executable -Arguments (@($basePython.Prefix) + @('-m', 'venv', $venvDirectory))
    }
    Write-Host '[2/5] Installing Python dependencies...' -ForegroundColor Yellow
    Invoke-Checked -Executable $venvPython -Arguments @('-m', 'pip', 'install', '--upgrade', 'pip')
    # If an existing environment uses a different wheel family, explicitly replace it.
    $currentWheel = & $venvPython -c "import importlib.metadata as m; print(next((d.version for d in m.distributions() if d.metadata['Name'].lower()=='torch'), 'missing'))"
    if ($LASTEXITCODE -ne 0) { throw 'Could not inspect the existing Python environment.' }
    $wheelMatches = ($Torch -eq 'cpu' -and $currentWheel -match '\+cpu$') -or ($Torch -ne 'cpu' -and $currentWheel -match "\+$Torch`$")
    $torchArguments = @('-m', 'pip', 'install', 'torch', 'torchvision', '--index-url', "https://download.pytorch.org/whl/$Torch")
    if ($currentWheel -ne 'missing' -and -not $wheelMatches) {
        Write-Host "Replacing existing PyTorch $currentWheel with the requested $Torch build. Close running backend processes first."
        $torchArguments += '--force-reinstall'
    }
    Invoke-Checked -Executable $venvPython -Arguments $torchArguments
    $requirements = if ($IncludeTests) { 'backend/requirements-dev.txt' } else { 'backend/requirements.txt' }
    Invoke-Checked -Executable $venvPython -Arguments @('-m', 'pip', 'install', '-r', $requirements)
    Invoke-Checked -Executable $venvPython -Arguments @('-m', 'pip', 'check')

    Write-Host '[3/5] Installing frontend dependencies from package-lock.json...' -ForegroundColor Yellow
    Invoke-Checked -Executable $npm.Source -Arguments @('--prefix', 'frontend', 'ci', '--include=dev')
    Write-Host '[4/5] Building frontend...' -ForegroundColor Yellow
    Invoke-Checked -Executable $npm.Source -Arguments @('--prefix', 'frontend', 'run', 'build')

    Write-Host '[5/5] Checking backend and preparing data caches...' -ForegroundColor Yellow
    $prepareArguments = @('backend/scripts/prepare_install.py', '--torch', $Torch)
    if (-not $SkipWeights) { $prepareArguments += '--prefetch-weights' }
    if ($PrefetchFlowers) { $prepareArguments += '--prefetch-flowers' }
    Invoke-Checked -Executable $venvPython -Arguments $prepareArguments

    Write-Host ''
    Write-Host 'Setup completed. Run .\run.bat, then open http://localhost:8000.' -ForegroundColor Green
    Write-Host 'For frontend development with hot reload, use the two-terminal commands in README.md.'
} catch {
    Write-Host ''
    Write-Host "SETUP FAILED: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    Pop-Location
}
