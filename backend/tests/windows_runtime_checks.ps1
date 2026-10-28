# Exercise native-installer decisions using stubs; never install a system package.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '../../windows-runtime.ps1')

$script:installerRuns = 0
$script:installerExit = 0
$script:validSignature = $true
$script:runtimeReady = $true

function Invoke-WebRequest {
    param([switch]$UseBasicParsing, [string]$Uri, [string]$OutFile)
    if ($Uri -ne 'https://aka.ms/vc14/vc_redist.x64.exe') { throw 'Unexpected download source' }
    [System.IO.File]::WriteAllText($OutFile, 'test stub; not executable')
}
function Get-AuthenticodeSignature {
    param([string]$LiteralPath)
    $status = if ($script:validSignature) { 'Valid' } else { 'NotSigned' }
    return [pscustomobject]@{ Status = $status; SignerCertificate = [pscustomobject]@{ Subject = 'CN=Microsoft Corporation, O=Microsoft Corporation, C=US' } }
}
function Start-Process {
    param($FilePath, $ArgumentList, $Verb, [switch]$Wait, [switch]$PassThru, $WindowStyle)
    if ($WindowStyle -ne 'Hidden' -or $Verb -ne 'RunAs' -or '/norestart' -notin $ArgumentList) { throw 'Installer must be hidden, elevated, and must not restart Windows automatically' }
    $script:installerRuns++
    return [pscustomobject]@{ ExitCode = $script:installerExit }
}
function Get-VisionLabVCRuntime {
    return [pscustomobject]@{ Ready = $script:runtimeReady; Missing = @('msvcp140.dll'); Old = @(); Versions = @{} }
}

foreach ($code in @(0, 1638)) {
    $script:installerExit = $code
    Install-VisionLabVCRuntime
}
if ($script:installerRuns -ne 2) { throw 'Expected both successful installer cases' }

foreach ($case in @(@{ Code = 3010; Pattern = 'requests a restart' }, @{ Code = 1603; Pattern = 'code 1603' })) {
    $script:installerExit = $case.Code
    $caught = $false
    try { Install-VisionLabVCRuntime } catch {
        if ($_.Exception.Message -notmatch $case.Pattern) { throw }
        $caught = $true
    }
    if (-not $caught) { throw 'Installer failure must stop setup' }
}

$script:validSignature = $false
$runsBefore = $script:installerRuns
$caught = $false
try { Install-VisionLabVCRuntime } catch {
    if ($_.Exception.Message -notmatch 'valid Microsoft signature') { throw }
    $caught = $true
}
if (-not $caught -or $script:installerRuns -ne $runsBefore) { throw 'An unsigned installer must never be executed' }

$script:runtimeReady = $false
$caught = $false
try { Test-VisionLabVCRuntime } catch {
    if ($_.Exception.Message -notmatch '-InstallVCRuntime') { throw }
    $caught = $true
}
if (-not $caught) { throw 'Missing runtime must be reported before installing packages' }
Write-Output 'Windows runtime installer checks passed.'
