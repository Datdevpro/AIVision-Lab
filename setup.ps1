<#
.SYNOPSIS
Prepare Vision Lab AI on Windows. All Python packages/caches stay in this project.
.EXAMPLE
.\setup.ps1
.EXAMPLE
.\setup.ps1 -Torch cpu -PrefetchFlowers
.EXAMPLE
.\setup.ps1 -CheckOnly
#>
[CmdletBinding()]
param(
    [ValidateSet('auto', 'cpu', 'cu118', 'cu124', 'cu126', 'cu128', 'cu130')]
    [string]$Torch = 'auto',
    [string]$PythonPath,
    [switch]$SkipWeights,
    [switch]$PrefetchFlowers,
    [switch]$IncludeTests,
    [switch]$InstallVCRuntime,
    [switch]$CpuCompatibility,
    [switch]$CheckOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$savedEnvironment = @{}
Get-ChildItem Env: | ForEach-Object { $savedEnvironment[$_.Name] = $_.Value }
$savedProtocol = [Net.ServicePointManager]::SecurityProtocol
Push-Location -LiteralPath $PSScriptRoot
try {
    Write-Host '=== Vision Lab AI - Windows setup ===' -ForegroundColor Cyan
    if ($env:OS -ne 'Windows_NT') { throw 'This script targets Windows. See README.md for manual installation.' }
    foreach ($required in @('backend/requirements.txt', 'frontend/package-lock.json', 'backend/scripts/prepare_install.py', 'backend/scripts/check_install_env.py', 'windows-runtime.ps1', 'windows-setup.ps1')) {
        if (-not (Test-Path -LiteralPath $required -PathType Leaf)) { throw "Missing $required. Use a complete clone of this repository." }
    }
    . (Join-Path $PSScriptRoot 'windows-setup.ps1')
    . (Join-Path $PSScriptRoot 'windows-runtime.ps1')
    if ($CpuCompatibility) {
        if ($Torch -notin @('auto', 'cpu')) { throw '-CpuCompatibility can only be used with -Torch auto/cpu.' }
        $Torch = 'cpu'
    }

    Write-Host '[1/6] Checking hardware and selecting CPU/CUDA...' -ForegroundColor Yellow
    $devices = @(Get-NvidiaDevices)
    foreach ($gpu in $devices) { Write-Host "NVIDIA GPU $($gpu.Index): $($gpu.Name); driver $($gpu.Driver); VRAM $($gpu.MemoryMB) MiB; compute $($gpu.Capability)" }
    $selectedTorch = Select-TorchBuild $Torch $devices
    if ($Torch -eq 'auto' -and $selectedTorch -eq 'cpu') {
        Write-Host 'Auto: no supported NVIDIA GPU/driver detected. Using CPU (AMD/Intel GPUs are not supported by this CUDA setup).'
    }
    Write-Host "PyTorch selection: $Torch -> $selectedTorch"
    $hardware = Get-SetupHardware $PSScriptRoot
    Test-SetupHardware $hardware $selectedTorch
    foreach ($relative in @('backend/.venv', '.cache', '.tools', 'frontend/node_modules', 'backend/data', 'backend/data/torch_cache')) {
        Assert-ProjectPath $PSScriptRoot (Join-Path $PSScriptRoot $relative)
    }
    if ($devices.Count -and $selectedTorch -ne 'cpu' -and $devices[0].MemoryMB -lt 4096) {
        Write-Warning 'GPU has less than 4 GB VRAM: use a small batch size; large models may run out of memory.'
    }
    $venvDirectory = Join-Path $PSScriptRoot 'backend/.venv'
    $venvPython = Join-Path $venvDirectory 'Scripts/python.exe'
    if ($CheckOnly) {
        $pythonInfo = Find-ProjectPython $PSScriptRoot $PythonPath
        $nodeInfo = Find-ProjectNode $PSScriptRoot
        if ($pythonInfo) { Write-Host "Python available: $($pythonInfo.Version) ($($pythonInfo.Executable))" }
        else { Write-Host 'Python 3.11/3.12 missing: normal setup will download Python 3.12 to .tools/python.' }
        if ($nodeInfo) { Write-Host "Node.js $($nodeInfo.Version); npm $($nodeInfo.NpmVersion)" }
        else { Write-Host 'Node.js 24/npm missing: normal setup will download them to .tools/node.' }
        if (-not (Get-VisionLabVCRuntime).Ready) { Write-Host 'Visual C++ Runtime needs installation/update. Use -InstallVCRuntime on normal setup.' }
        if (Test-Path -LiteralPath $venvPython -PathType Leaf) { Assert-ProjectVenv $PSScriptRoot }
        Write-Host 'Preflight completed. No downloads, installations or dependency changes were performed.' -ForegroundColor Green
        exit 0
    }

    # Refuse to modify packages underneath an active backend (or any Python in this venv).
    $active = @(Get-CimInstance Win32_Process -Filter "Name = 'python.exe' OR Name = 'pythonw.exe'" | Where-Object {
        $_.ExecutablePath -and $_.ExecutablePath.StartsWith($venvDirectory + '\', [StringComparison]::OrdinalIgnoreCase)
    })
    if ($active.Count) { throw 'Close the running backend/Python processes in backend/.venv, then rerun setup.' }
    Set-ProjectInstallEnvironment $PSScriptRoot
    [Net.ServicePointManager]::SecurityProtocol = $savedProtocol -bor [Net.SecurityProtocolType]::Tls12
    $ProgressPreference = 'SilentlyContinue'
    if ($InstallVCRuntime -or -not (Get-VisionLabVCRuntime).Ready) { Install-VisionLabVCRuntime }
    Test-VisionLabVCRuntime

    Write-Host '[2/6] Preparing local Python, Node.js and virtual environment...' -ForegroundColor Yellow
    if (Test-Path -LiteralPath $venvDirectory) {
        $reuse = $false
        if (Test-Path -LiteralPath $venvPython -PathType Leaf) {
            $info = Get-PythonInfo $venvPython
            if ($info) {
                try { Assert-ProjectVenv $PSScriptRoot; $reuse = $true }
                catch { Write-Warning $_.Exception.Message }
            }
        }
        if (-not $reuse) {
            # Preserve incompatible/moved environments, then create a new local one.
            $backup = $venvDirectory + '.backup-' + [guid]::NewGuid().ToString('N')
            Assert-ProjectPath $PSScriptRoot $backup
            Move-Item -LiteralPath $venvDirectory -Destination $backup
            Write-Warning "Incompatible environment preserved at $backup. A fresh backend/.venv will be created."
        }
    }
    $basePython = Find-ProjectPython $PSScriptRoot $PythonPath
    if (-not $basePython) { $basePython = Install-ProjectPython $PSScriptRoot }
    Write-Host "Python $($basePython.Version) (64-bit): $($basePython.Executable)"
    if (-not (Test-Path -LiteralPath $venvPython -PathType Leaf)) {
        Invoke-Checked $basePython.Executable (@($basePython.Prefix) + @('-I', '-B', '-m', 'venv', $venvDirectory))
    }
    Assert-ProjectVenv $PSScriptRoot
    $env:VIRTUAL_ENV = $venvDirectory
    $env:PATH = (Join-Path $venvDirectory 'Scripts') + ';' + $env:PATH
    $nodeInfo = Find-ProjectNode $PSScriptRoot
    if (-not $nodeInfo) { $nodeInfo = Install-ProjectNode $PSScriptRoot }
    $env:PATH = (Split-Path $nodeInfo.Node) + ';' + $env:PATH
    Write-Host "Node.js $($nodeInfo.Version); npm $($nodeInfo.NpmVersion): $($nodeInfo.Node)"

    Write-Host '[3/6] Installing Python packages exclusively into backend/.venv...' -ForegroundColor Yellow
    Invoke-ProjectPip $PSScriptRoot @('install', '--no-user', '--upgrade', 'pip')
    Install-ProjectTorch $PSScriptRoot $selectedTorch
    $requirements = if ($IncludeTests) { 'backend/requirements-dev.txt' } else { 'backend/requirements.txt' }
    # Prevent requirements resolution from replacing the chosen torch/torchvision pair.
    $constraints = Join-Path $PSScriptRoot '.cache/torch-constraints.txt'
    @(Get-TorchPackages $selectedTorch) | Set-Content -LiteralPath $constraints -Encoding ASCII
    Invoke-ProjectPip $PSScriptRoot @('install', '--no-user', '--upgrade', '-r', $requirements, '-c', $constraints)
    Invoke-ProjectPip $PSScriptRoot @('check')
    $selectedTorch = Confirm-ProjectTorch $PSScriptRoot $Torch $selectedTorch
    @(Get-TorchPackages $selectedTorch) | Set-Content -LiteralPath $constraints -Encoding ASCII

    Write-Host '[4/6] Installing frontend packages into frontend/node_modules...' -ForegroundColor Yellow
    Invoke-Checked $nodeInfo.Npm @('--prefix', 'frontend', 'ci', '--include=dev', '--cache', (Join-Path $PSScriptRoot '.cache/npm'))
    Write-Host '[5/6] Building frontend...' -ForegroundColor Yellow
    Invoke-Checked $nodeInfo.Npm @('--prefix', 'frontend', 'run', 'build')
    Write-Host '[6/6] Checking backend and preparing local data caches...' -ForegroundColor Yellow
    $prepareArguments = @('-I', '-B', 'backend/scripts/prepare_install.py', '--torch', $selectedTorch)
    if (-not $SkipWeights) { $prepareArguments += '--prefetch-weights' }
    if ($PrefetchFlowers) { $prepareArguments += '--prefetch-flowers' }
    Invoke-Checked $venvPython $prepareArguments
    Write-Host "Setup completed ($selectedTorch). Run .\run.bat, then open http://localhost:8000." -ForegroundColor Green
    Write-Host 'Python packages: backend/.venv | Runtime downloads: .tools | Download/build caches: .cache'
} catch {
    Write-Host "SETUP FAILED: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    # Also restore the caller's environment when invoked directly as .\setup.ps1.
    foreach ($entry in @(Get-ChildItem Env:)) {
        if (-not $savedEnvironment.ContainsKey($entry.Name)) { [Environment]::SetEnvironmentVariable($entry.Name, $null, 'Process') }
    }
    foreach ($name in $savedEnvironment.Keys) { [Environment]::SetEnvironmentVariable($name, $savedEnvironment[$name], 'Process') }
    [Net.ServicePointManager]::SecurityProtocol = $savedProtocol
    Pop-Location
}
