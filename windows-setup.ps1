# Shared Windows setup functions. Dot-sourcing does not change the machine.
function Invoke-Checked {
    param([string]$Executable, [string[]]$Arguments)
    & $Executable @Arguments | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "Command failed (exit $LASTEXITCODE): $Executable $($Arguments -join ' ')" }
}

function Assert-ProjectPath {
    param([string]$Root, [string]$Path)
    $rootPath = [IO.Path]::GetFullPath($Root).TrimEnd('\', '/')
    $full = [IO.Path]::GetFullPath($Path)
    if (-not $full.StartsWith($rootPath + '\', [StringComparison]::OrdinalIgnoreCase)) {
        throw "Setup path must stay inside the project: $full"
    }
    # Reject junctions/symlinks which could redirect packages or caches to another disk.
    $cursor = $full
    while ($cursor -and $cursor -ne $rootPath) {
        if (Test-Path -LiteralPath $cursor) {
            if ((Get-Item -Force -LiteralPath $cursor).Attributes -band [IO.FileAttributes]::ReparsePoint) {
                throw "Setup refuses a linked directory/file: $cursor"
            }
        }
        $cursor = [IO.Path]::GetDirectoryName($cursor)
    }
}

function Set-ProjectInstallEnvironment {
    param([string]$Root)
    $cache = Join-Path $Root '.cache'
    $tools = Join-Path $Root '.tools'
    foreach ($path in @($cache, $tools, (Join-Path $Root 'backend/.venv'), (Join-Path $Root 'frontend/node_modules'))) {
        Assert-ProjectPath $Root $path
    }
    # Clear inherited pip destinations/options, including PIP_TARGET, PIP_PREFIX and PIP_USER.
    foreach ($entry in @(Get-ChildItem Env: | Where-Object { $_.Name -like 'PIP_*' -or $_.Name -like 'PYTHON*' -or $_.Name -like 'UV_*' -or $_.Name -like 'NPM_CONFIG_*' })) {
        [Environment]::SetEnvironmentVariable($entry.Name, $null, 'Process')
    }
    $values = @{
        # pip compares os.devnull case-sensitively: Windows requires lowercase 'nul'.
        PIP_CONFIG_FILE = 'nul'; PIP_REQUIRE_VIRTUALENV = 'true'; PIP_DISABLE_PIP_VERSION_CHECK = '1'
        PIP_CACHE_DIR = (Join-Path $cache 'pip'); PYTHONNOUSERSITE = '1'; PYTHONUTF8 = '1'
        PYTHONDONTWRITEBYTECODE = '1'; PYTHONPYCACHEPREFIX = (Join-Path $cache 'pycache')
        PYTHONUSERBASE = (Join-Path $cache 'python-user-disabled')
        TEMP = (Join-Path $cache 'tmp'); TMP = (Join-Path $cache 'tmp')
        UV_CACHE_DIR = (Join-Path $cache 'uv'); UV_PYTHON_CACHE_DIR = (Join-Path $cache 'python-downloads')
        UV_PYTHON_INSTALL_DIR = (Join-Path $tools 'python'); UV_PYTHON_BIN_DIR = (Join-Path $tools 'python-bin')
        UV_PYTHON_INSTALL_BIN = 'false'; UV_PYTHON_INSTALL_REGISTRY = 'false'; UV_PYTHON_NO_REGISTRY = 'true'
        UV_NO_MODIFY_PATH = '1'; UV_NO_CONFIG = 'true'
        NPM_CONFIG_CACHE = (Join-Path $cache 'npm'); NPM_CONFIG_PREFIX = (Join-Path $tools 'npm-global-unused')
        NPM_CONFIG_USERCONFIG = (Join-Path $cache 'npm-user.npmrc'); NPM_CONFIG_GLOBALCONFIG = (Join-Path $cache 'npm-global.npmrc')
        NPM_CONFIG_UPDATE_NOTIFIER = 'false'
        VISIONLAB_DATA_DIR = (Join-Path $Root 'backend/data')
        VISIONLAB_TORCH_HOME = (Join-Path $Root 'backend/data/torch_cache')
        TORCH_HOME = (Join-Path $Root 'backend/data/torch_cache')
    }
    foreach ($name in $values.Keys) { [Environment]::SetEnvironmentVariable($name, $values[$name], 'Process') }
    foreach ($relative in @('.tools', '.cache/tmp', '.cache/downloads', '.cache/pip', '.cache/npm', '.cache/uv', '.cache/python-downloads')) {
        $path = Join-Path $Root $relative
        Assert-ProjectPath $Root $path
        New-Item -ItemType Directory -Path $path -Force | Out-Null
    }
    foreach ($config in @($env:NPM_CONFIG_USERCONFIG, $env:NPM_CONFIG_GLOBALCONFIG)) {
        Assert-ProjectPath $Root $config
        [IO.File]::WriteAllText($config, '')
    }
}

function Get-PythonInfo {
    param([string]$Executable, [string[]]$Prefix = @())
    $ErrorActionPreference = 'Continue'
    try {
        $probe = "import json,struct,sys; print(json.dumps({'version':sys.version.split()[0],'bits':struct.calcsize('P')*8,'supported':sys.version_info[:2] in [(3,11),(3,12)]}))"
        $output = & $Executable @Prefix -I -B -c $probe 2>$null
        if ($LASTEXITCODE -eq 0) {
            $info = ($output -join "`n") | ConvertFrom-Json
            if ($info.supported -and $info.bits -eq 64) {
                return [pscustomobject]@{ Executable = $Executable; Prefix = $Prefix; Version = $info.version }
            }
        }
    } catch { return $null }
    return $null
}

function Find-ProjectPython {
    param([string]$Root, [string]$PythonPath)
    if ($PythonPath) {
        $command = Get-Command -Name $PythonPath -CommandType Application -ErrorAction SilentlyContinue
        if ($command) {
            $info = Get-PythonInfo $command.Source
            if ($info) { return $info }
        }
        throw '-PythonPath must point to a working 64-bit Python 3.11 or 3.12 executable.'
    }
    $candidates = @((Join-Path $Root 'backend/.venv/Scripts/python.exe'))
    $managed = Join-Path $Root '.tools/python'
    if (Test-Path -LiteralPath $managed) {
        $candidates += @(Get-ChildItem -LiteralPath $managed -Filter 'cpython-*windows*' -Directory | Where-Object { -not ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) } | ForEach-Object { Join-Path $_.FullName 'python.exe' })
    }
    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate -PathType Leaf) {
            $info = Get-PythonInfo $candidate
            if ($info) { return $info }
        }
    }
    # Avoid py.exe probes: newer Python managers may auto-install missing runtimes
    # outside the project. Fall back to a managed local Python instead.
    foreach ($name in @('python.exe', 'python3.exe')) {
        $command = Get-Command $name -CommandType Application -ErrorAction SilentlyContinue
        if ($command -and $command.Source -notlike '*\Microsoft\WindowsApps\*') {
            $info = Get-PythonInfo $command.Source
            if ($info) { return $info }
        }
    }
    return $null
}

function Receive-VerifiedArchive {
    param([string]$Root, [string]$Url, [string]$Sha256, [string]$Name)
    if ($Sha256 -notmatch '^[a-fA-F0-9]{64}$') { throw 'Missing or invalid download checksum.' }
    $archive = Join-Path $Root ".cache/downloads/$Name"
    Assert-ProjectPath $Root $archive
    if (-not (Test-Path -LiteralPath $archive) -or (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $Sha256) {
        Write-Host "Downloading $Url"
        Invoke-WebRequest -UseBasicParsing -Uri $Url -OutFile $archive
    }
    if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $Sha256) {
        throw "Checksum mismatch for $Name. The downloaded archive will not be executed."
    }
    return $archive
}

function Install-ProjectPython {
    param([string]$Root)
    $uv = Join-Path $Root '.tools/uv/uv.exe'
    Assert-ProjectPath $Root $uv
    if (-not (Test-Path -LiteralPath $uv -PathType Leaf)) {
        # Pinned portable uv binary, checksum published in the official GitHub release.
        $archive = Receive-VerifiedArchive $Root 'https://github.com/astral-sh/uv/releases/download/0.13.6/uv-x86_64-pc-windows-msvc.zip' 'a2a8820d5eea32f08ef467ef3b7f66883a9b076d5737a2fc2fbb5f458d1bb50f' 'uv-0.13.6-win-x64.zip'
        Expand-Archive -LiteralPath $archive -DestinationPath (Split-Path $uv) -Force
    }
    Write-Host 'Installing managed Python 3.12 inside .tools/python (no system PATH/registry changes)...'
    Invoke-Checked $uv @('python', 'install', '3.12', '--no-bin', '--no-registry')
    # uv also creates a minor-version junction. Use the real version directory so
    # the project's path guard does not need to allow junctions for installations.
    $directory = Get-ChildItem -LiteralPath (Join-Path $Root '.tools/python') -Filter 'cpython-3.12.*windows*' -Directory |
        Where-Object { -not ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) } | Select-Object -First 1
    if (-not $directory) { throw 'Could not locate the downloaded Python.' }
    $path = Join-Path $directory.FullName 'python.exe'
    Assert-ProjectPath $Root $path
    $info = Get-PythonInfo $path
    if (-not $info) { throw 'Downloaded Python did not pass the version/architecture check.' }
    return $info
}

function Find-ProjectNode {
    param([string]$Root)
    $directories = @((Join-Path $Root '.tools/node'))
    $systemNode = Get-Command node.exe -CommandType Application -ErrorAction SilentlyContinue
    if ($systemNode) { $directories += Split-Path $systemNode.Source }
    foreach ($directory in $directories) {
        $node = Join-Path $directory 'node.exe'
        $npm = Join-Path $directory 'npm.cmd'
        if ((Test-Path -LiteralPath $node) -and (Test-Path -LiteralPath $npm)) {
            $output = & $node --version
            if ($LASTEXITCODE -eq 0 -and $output -match '^v24\.') {
                $architecture = & $node -p process.arch
                if ($LASTEXITCODE -ne 0 -or $architecture -ne 'x64') { continue }
                $npmVersion = & $npm --version
                if ($LASTEXITCODE -eq 0 -and $npmVersion -match '^(\d+)\.' -and [int]$Matches[1] -ge 10) {
                    return [pscustomobject]@{ Node = $node; Npm = $npm; Version = $output; NpmVersion = $npmVersion }
                }
            }
        }
    }
    return $null
}

function Install-ProjectNode {
    param([string]$Root)
    $base = 'https://nodejs.org/dist/latest-v24.x'
    $sums = (Invoke-WebRequest -UseBasicParsing -Uri "$base/SHASUMS256.txt").Content
    if ($sums -is [byte[]]) { $sums = [Text.Encoding]::UTF8.GetString($sums) }
    if ($sums -notmatch '(?m)^([a-f0-9]{64})\s+(node-v24\.\d+\.\d+-win-x64\.zip)\s*$') { throw 'Could not find the official Node.js 24 x64 checksum.' }
    $sha = $Matches[1]; $name = $Matches[2]
    $archive = Receive-VerifiedArchive $Root "$base/$name" $sha $name
    $directory = Join-Path $Root '.tools/node'
    Assert-ProjectPath $Root $directory
    $extracted = Join-Path $Root ('.tools/' + [IO.Path]::GetFileNameWithoutExtension($name))
    Assert-ProjectPath $Root $extracted
    Expand-Archive -LiteralPath $archive -DestinationPath (Join-Path $Root '.tools') -Force
    if (Test-Path -LiteralPath $directory) {
        # Keep a broken/old local runtime for inspection; never delete it automatically.
        Move-Item -LiteralPath $directory -Destination ($directory + '.backup-' + [guid]::NewGuid().ToString('N'))
    }
    Move-Item -LiteralPath $extracted -Destination $directory
    $info = Find-ProjectNode $Root
    if (-not $info) { throw 'Downloaded Node.js/npm failed the version check.' }
    return $info
}

function Get-SetupHardware {
    param([string]$Root)
    $os = Get-CimInstance Win32_OperatingSystem
    $cpu = @(Get-CimInstance Win32_Processor)[0]
    $disk = [IO.DriveInfo]::new([IO.Path]::GetPathRoot($Root))
    return [pscustomobject]@{
        WindowsVersion = [version]$os.Version; Architecture = $cpu.Architecture
        Cpu = $cpu.Name; Cores = $cpu.NumberOfLogicalProcessors
        RamGB = [math]::Round([double]$os.TotalVisibleMemorySize / 1MB, 1)
        FreeGB = [math]::Round($disk.AvailableFreeSpace / 1GB, 1)
    }
}

function Test-SetupHardware {
    param($Hardware, [string]$Torch)
    if ($Hardware.WindowsVersion -lt [version]'10.0' -or $Hardware.Architecture -ne 9) { throw 'Windows 10/11 x64 on an Intel/AMD processor is required.' }
    if ($Hardware.RamGB -lt 4) { throw 'Setup requires at least 4 GB RAM; 8 GB or more is recommended.' }
    $minimumDisk = if ($Torch -eq 'cpu') { 8 } else { 16 }
    if ($Hardware.FreeGB -lt $minimumDisk) { throw "At least $minimumDisk GB free space is required on the project drive; found $($Hardware.FreeGB) GB." }
    if ($Hardware.RamGB -lt 8) { Write-Warning 'Less than 8 GB RAM: use small datasets and batch sizes.' }
    Write-Host "CPU: $($Hardware.Cpu) ($($Hardware.Cores) logical processors); RAM: $($Hardware.RamGB) GB; project drive free: $($Hardware.FreeGB) GB"
}

function Get-NvidiaDevices {
    $command = Get-Command nvidia-smi.exe -CommandType Application -ErrorAction SilentlyContinue
    if (-not $command) { return }
    $ErrorActionPreference = 'Continue'
    $rows = & $command.Source '--query-gpu=index,name,driver_version,memory.total,compute_cap' '--format=csv,noheader,nounits' 2>$null
    if ($LASTEXITCODE -ne 0) { Write-Warning 'NVIDIA driver query failed; auto setup will use CPU.'; return }
    foreach ($row in $rows) {
        $parts = $row -split ','
        if ($parts.Count -ne 5) { continue }
        try {
            [pscustomobject]@{ Index = [int]$parts[0].Trim(); Name = $parts[1].Trim(); Driver = [version]$parts[2].Trim(); MemoryMB = [int]$parts[3].Trim(); Capability = [version]$parts[4].Trim() }
        } catch { Write-Warning "Could not parse NVIDIA device: $row" }
    }
}

function Select-TorchBuild {
    param([string]$Requested, [array]$Devices)
    if ($Requested -ne 'auto') { return $Requested }
    # Conservative Windows driver thresholds, followed by a real CUDA model test.
    # CUDA 11.8 retains support for Maxwell/Pascal/Volta; 12.8 supports Blackwell.
    if (@($Devices).Count -eq 0) { return 'cpu' }
    $gpu = $Devices[0]
    if ($gpu.Capability -lt [version]'5.0') { return 'cpu' }
    if ($gpu.Capability -ge [version]'7.5' -and $gpu.Driver -ge [version]'571.96') { return 'cu128' }
    if ($gpu.Capability -lt [version]'10.0' -and $gpu.Driver -ge [version]'522.06') { return 'cu118' }
    return 'cpu'
}

function Get-TorchPackages {
    param([string]$Build)
    switch ($Build) {
        'cpu'   { return @('torch==2.8.0', 'torchvision==0.23.0') }
        'cu118' { return @('torch==2.7.1', 'torchvision==0.22.1') }
        'cu124' { return @('torch==2.6.0', 'torchvision==0.21.0') }
        'cu126' { return @('torch==2.8.0', 'torchvision==0.23.0') }
        'cu128' { return @('torch==2.8.0', 'torchvision==0.23.0') }
        'cu130' { return @('torch==2.9.1', 'torchvision==0.24.1') }
        default { throw "Unsupported PyTorch build: $Build" }
    }
}

function Assert-ProjectVenv {
    param([string]$Root)
    $python = Join-Path $Root 'backend/.venv/Scripts/python.exe'
    Assert-ProjectPath $Root $python
    # This independent Python guard checks prefix, site-packages, user-site and pip location.
    Invoke-Checked $python @('-I', '-B', (Join-Path $Root 'backend/scripts/check_install_env.py'), '--root', $Root)
}

function Invoke-ProjectPip {
    param([string]$Root, [string[]]$PipArguments)
    Assert-ProjectVenv $Root
    $python = Join-Path $Root 'backend/.venv/Scripts/python.exe'
    # Config/env isolation is set above; every invocation must be in this exact venv.
    Invoke-Checked $python (@('-I', '-B', '-m', 'pip', '--require-virtualenv', '--cache-dir', (Join-Path $Root '.cache/pip'), '--disable-pip-version-check', '--no-input') + $PipArguments)
}

function Install-ProjectTorch {
    param([string]$Root, [string]$Build)
    $python = Join-Path $Root 'backend/.venv/Scripts/python.exe'
    $expected = @(Get-TorchPackages $Build)
    $expectedTorch = ($expected[0] -split '==')[1] + '+' + $Build
    $expectedVision = ($expected[1] -split '==')[1] + '+' + $Build
    $probe = "import importlib.metadata as m; print('|'.join(next((d.version for d in m.distributions() if d.metadata['Name'].lower()==n),'missing') for n in ['torch','torchvision']))"
    $current = & $python -I -B -c $probe
    if ($LASTEXITCODE -ne 0) { throw 'Could not inspect PyTorch package metadata.' }
    if ($current -eq "$expectedTorch|$expectedVision") { Write-Host "Keeping matching PyTorch packages: $current"; return }
    Write-Host "Installing $($expected -join ', ') ($Build) into backend/.venv..."
    Invoke-ProjectPip $Root (@('install', '--no-user', '--upgrade', '--force-reinstall') + $expected + @('--index-url', "https://download.pytorch.org/whl/$Build"))
}

function Confirm-ProjectTorch {
    param([string]$Root, [string]$Requested, [string]$Build)
    $python = Join-Path $Root 'backend/.venv/Scripts/python.exe'
    $prepare = Join-Path $Root 'backend/scripts/prepare_install.py'
    try {
        Invoke-Checked $python @('-I', '-B', $prepare, '--torch', $Build)
    } catch {
        if ($Requested -ne 'auto' -or $Build -eq 'cpu') { throw }
        Write-Warning "GPU validation failed: $($_.Exception.Message)"
        Write-Warning 'Auto mode is switching to CPU. To require GPU and see a hard failure, rerun with an explicit -Torch build.'
        $Build = 'cpu'
        Install-ProjectTorch $Root $Build
        Invoke-ProjectPip $Root @('check')
        Invoke-Checked $python @('-I', '-B', $prepare, '--torch', $Build)
    }
    return $Build
}
