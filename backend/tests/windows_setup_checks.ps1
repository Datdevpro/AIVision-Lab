# Test setup decisions and containment without changing system runtimes/packages.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '../../windows-setup.ps1')

function Assert-Equal {
    param($Actual, $Expected)
    if ($Actual -ne $Expected) { throw "Expected '$Expected', got '$Actual'." }
}
function Assert-Rejected {
    param([scriptblock]$Action, [string]$Pattern)
    try { & $Action } catch {
        if ($_.Exception.Message -notmatch $Pattern) { throw }
        return
    }
    throw "Expected rejection: $Pattern"
}
function New-Gpu {
    param([string]$Driver, [string]$Capability)
    return [pscustomobject]@{ Driver = [version]$Driver; Capability = [version]$Capability }
}
Assert-Equal (Select-TorchBuild 'auto' @()) 'cpu'
Assert-Equal (Select-TorchBuild 'cpu' @((New-Gpu '580.0' '8.9'))) 'cpu'
Assert-Equal (Select-TorchBuild 'auto' @((New-Gpu '546.12' '8.9'))) 'cu118'
Assert-Equal (Select-TorchBuild 'auto' @((New-Gpu '571.96' '8.9'))) 'cu128'
Assert-Equal (Select-TorchBuild 'auto' @((New-Gpu '580.0' '12.0'))) 'cu128'
Assert-Equal (Select-TorchBuild 'auto' @((New-Gpu '546.12' '12.0'))) 'cpu'
Assert-Equal (Select-TorchBuild 'auto' @((New-Gpu '580.0' '6.1'))) 'cu118'
Assert-Equal (Select-TorchBuild 'auto' @((New-Gpu '510.0' '8.6'))) 'cpu'
Assert-Equal (Select-TorchBuild 'auto' @((New-Gpu '580.0' '3.5'))) 'cpu'
Assert-Equal ((Get-TorchPackages 'cu118') -join ',') 'torch==2.7.1,torchvision==0.22.1'
Assert-Equal ((Get-TorchPackages 'cpu') -join ',') 'torch==2.8.0,torchvision==0.23.0'

$hardware = [pscustomobject]@{ WindowsVersion = [version]'10.0.19045'; Architecture = 9; Cpu = 'Test CPU'; Cores = 4; RamGB = 8; FreeGB = 20 }
Test-SetupHardware $hardware 'cu118'
$hardware.RamGB = 2
Assert-Rejected { Test-SetupHardware $hardware 'cpu' } '4 GB RAM'
$hardware.RamGB = 8; $hardware.FreeGB = 10
Test-SetupHardware $hardware 'cpu'
Assert-Rejected { Test-SetupHardware $hardware 'cu128' } '16 GB'
$hardware.FreeGB = 20; $hardware.Architecture = 12
Assert-Rejected { Test-SetupHardware $hardware 'cpu' } 'x64'

$repository = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$testRoot = Join-Path $repository ('.setup-smoke/checks-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testRoot -Force | Out-Null
Assert-ProjectPath $testRoot (Join-Path $testRoot 'backend/.venv')
Assert-Rejected { Assert-ProjectPath $testRoot (Join-Path $testRoot '../escape') } 'inside the project'
Assert-Rejected { Assert-ProjectPath $testRoot ($testRoot + '-sibling/packages') } 'inside the project'
# A junction into another project folder is still refused.
$linked = Join-Path $testRoot 'linked'
New-Item -ItemType Junction -Path $linked -Target $repository | Out-Null
Assert-Rejected { Assert-ProjectPath $testRoot (Join-Path $linked 'packages') } 'linked directory'

$env:PIP_TARGET = 'C:\outside-packages'
$env:PIP_PREFIX = 'C:\outside-prefix'
$env:PIP_USER = 'true'
$env:PYTHONPATH = 'C:\outside-imports'
$env:UV_PYTHON_INSTALL_DIR = 'C:\outside-python'
$env:NPM_CONFIG_CACHE = 'C:\outside-npm'
Set-ProjectInstallEnvironment $testRoot
foreach ($name in @('PIP_TARGET', 'PIP_PREFIX', 'PIP_USER', 'PYTHONPATH')) {
    if (Test-Path "Env:$name") { throw "$name must be removed before installation" }
}
foreach ($name in @('PIP_CACHE_DIR', 'TEMP', 'TMP', 'UV_CACHE_DIR', 'UV_PYTHON_INSTALL_DIR', 'UV_PYTHON_CACHE_DIR', 'NPM_CONFIG_CACHE', 'NPM_CONFIG_USERCONFIG', 'NPM_CONFIG_GLOBALCONFIG', 'TORCH_HOME')) {
    Assert-ProjectPath $testRoot ([Environment]::GetEnvironmentVariable($name))
}
Assert-Equal $env:PIP_REQUIRE_VIRTUALENV 'true'
if ($env:PIP_CONFIG_FILE -cne 'nul') { throw "pip requires the exact lowercase os.devnull value 'nul' on Windows" }
Assert-Equal $env:UV_PYTHON_INSTALL_REGISTRY 'false'

# Exercise real pip with poisoned destination settings, without installing a package.
# Even the test venv and its bundled pip are created inside this repository.
$basePython = Join-Path $repository 'backend/.venv/Scripts/python.exe'
if (Test-Path -LiteralPath $basePython) {
    $testScripts = Join-Path $testRoot 'backend/scripts'
    New-Item -ItemType Directory -Path $testScripts -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $repository 'backend/scripts/check_install_env.py') -Destination $testScripts
    $testVenv = Join-Path $testRoot 'backend/.venv'
    Invoke-Checked $basePython @('-I', '-B', '-m', 'venv', $testVenv)
    [IO.File]::WriteAllText((Join-Path $testVenv 'pip.ini'), "[install]`ntarget=C:\VisionLab-Forbidden-Setup-Test`n[global]`ncache-dir=C:\VisionLab-Forbidden-Cache`n")
    $env:PIP_TARGET = 'C:\VisionLab-Forbidden-Setup-Test'
    Set-ProjectInstallEnvironment $testRoot
    Invoke-ProjectPip $testRoot @('install', '--no-user', '--dry-run', '--no-index', '--no-deps', 'pip')
}

# Do not execute a corrupt download or even attempt to download without a checksum.
Assert-Rejected { Receive-VerifiedArchive $testRoot 'https://example.invalid/file.zip' '' 'missing.zip' } 'checksum'
$corrupt = Join-Path $testRoot '.cache/downloads/corrupt.zip'
[IO.File]::WriteAllText($corrupt, 'corrupt')
function Invoke-WebRequest { param([switch]$UseBasicParsing, $Uri, $OutFile) [IO.File]::WriteAllText($OutFile, 'still corrupt') }
Assert-Rejected { Receive-VerifiedArchive $testRoot 'https://example.invalid/file.zip' ('0' * 64) 'corrupt.zip' } 'Checksum mismatch'

# Every pip call must stop before invoking pip if the venv guard rejects it.
function Assert-ProjectVenv { param([string]$Root) throw 'Guard refused invalid venv' }
function Invoke-Checked { param($Executable, $Arguments) throw 'Pip must not execute' }
Assert-Rejected { Invoke-ProjectPip $testRoot @('install', 'example') } 'Guard refused'

# An automatic GPU failure falls back to CPU; an explicit GPU request must fail.
$script:installedBuilds = @()
$script:cpuFails = $false
function Install-ProjectTorch { param([string]$Root, [string]$Build) $script:installedBuilds += $Build }
function Invoke-ProjectPip { param([string]$Root, [string[]]$PipArguments) }
function Invoke-Checked {
    param($Executable, $Arguments)
    if ($Arguments[-1] -ne 'cpu') { throw 'GPU kernel test failed' }
    if ($script:cpuFails) { throw 'CPU import failed' }
}
Assert-Equal (Confirm-ProjectTorch $testRoot 'auto' 'cu118') 'cpu'
Assert-Equal ($script:installedBuilds -join ',') 'cpu'
$script:installedBuilds = @()
Assert-Rejected { Confirm-ProjectTorch $testRoot 'cu128' 'cu128' } 'GPU kernel test failed'
Assert-Equal $script:installedBuilds.Count 0
$script:cpuFails = $true
Assert-Rejected { Confirm-ProjectTorch $testRoot 'auto' 'cpu' } 'CPU import failed'
Assert-Rejected { Confirm-ProjectTorch $testRoot 'auto' 'cu118' } 'CPU import failed'
Write-Output 'Windows setup containment and hardware checks passed.'
