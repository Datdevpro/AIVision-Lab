# Functions only. Dot-sourcing this file never downloads or installs anything.
function Get-VisionLabVCRuntime {
    $systemDirectory = Join-Path $env:WINDIR 'System32'
    if ([Environment]::Is64BitOperatingSystem -and -not [Environment]::Is64BitProcess) {
        $systemDirectory = Join-Path $env:WINDIR 'Sysnative'
    }
    $missing = @()
    $versions = @{}
    foreach ($dll in @('msvcp140.dll', 'vcruntime140.dll', 'vcruntime140_1.dll')) {
        $path = Join-Path $systemDirectory $dll
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
            $missing += $dll
        } else {
            $file = Get-Item -LiteralPath $path
            $info = $file.VersionInfo
            $versions[$dll] = [version](('{0}.{1}.{2}.{3}' -f $info.FileMajorPart, $info.FileMinorPart, $info.FileBuildPart, $info.FilePrivatePart))
        }
    }
    # VS 2022 17.10 changed std::mutex initialization; older MSVC runtimes can
    # fail during c10.dll initialization in newer PyTorch Windows builds.
    $old = @($versions.Keys | Where-Object { $versions[$_] -lt [version]'14.40.0.0' })
    return [pscustomobject]@{ Ready = ($missing.Count -eq 0 -and $old.Count -eq 0); Missing = $missing; Old = $old; Versions = $versions }
}

function Install-VisionLabVCRuntime {
    $installer = Join-Path ([System.IO.Path]::GetTempPath()) ('visionlab-vc-redist-' + [guid]::NewGuid().ToString('N') + '.exe')
    $previousProtocol = [Net.ServicePointManager]::SecurityProtocol
    try {
        [Net.ServicePointManager]::SecurityProtocol = $previousProtocol -bor [Net.SecurityProtocolType]::Tls12
        $ProgressPreference = 'SilentlyContinue'
        Write-Host 'Downloading Microsoft Visual C++ Runtime x64 from Microsoft...' -ForegroundColor Yellow
        Invoke-WebRequest -UseBasicParsing -Uri 'https://aka.ms/vc14/vc_redist.x64.exe' -OutFile $installer
        $signature = Get-AuthenticodeSignature -LiteralPath $installer
        if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch '(^|,\s*)O=Microsoft Corporation(,|$)') {
            throw 'The Visual C++ installer does not have a valid Microsoft signature. It was not executed.'
        }
        Write-Host 'Installing/updating Microsoft Visual C++ Runtime x64. Windows may ask for administrator approval.'
        $process = Start-Process -FilePath $installer -ArgumentList @('/install', '/quiet', '/norestart') -Verb RunAs -Wait -PassThru -WindowStyle Hidden
        if ($process.ExitCode -eq 3010 -or $process.ExitCode -eq 1641) {
            throw 'Visual C++ Runtime installed, but Windows requests a restart. Restart Windows, then rerun setup without -InstallVCRuntime.'
        }
        if ($process.ExitCode -notin @(0, 1638)) {
            throw "Microsoft Visual C++ installer exited with code $($process.ExitCode). Run the official installer manually and choose Install or Repair."
        }
        if (-not (Get-VisionLabVCRuntime).Ready) {
            throw 'Visual C++ Runtime x64 is still missing/outdated. Restart Windows or repair it using the Microsoft installer.'
        }
    } finally {
        [Net.ServicePointManager]::SecurityProtocol = $previousProtocol
        if (Test-Path -LiteralPath $installer -PathType Leaf) { Remove-Item -LiteralPath $installer -Force -ErrorAction SilentlyContinue }
    }
}

function Test-VisionLabVCRuntime {
    $runtime = Get-VisionLabVCRuntime
    foreach ($name in @($runtime.Versions.Keys | Sort-Object)) {
        Write-Host "VC++ x64: $name $($runtime.Versions[$name])"
    }
    if (-not $runtime.Ready) {
        throw ('Microsoft Visual C++ Runtime x64 is missing or too old. Run .\setup.bat -InstallVCRuntime, or install/repair https://aka.ms/vc14/vc_redist.x64.exe and restart Windows. Missing: ' + ($runtime.Missing -join ', ') + '; outdated: ' + ($runtime.Old -join ', '))
    }
}
