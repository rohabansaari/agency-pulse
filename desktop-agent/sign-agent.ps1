# Optional Authenticode signing for AgencyPulseAgent.exe
# Requires a code-signing certificate installed in the Windows certificate store
# or paths to a .pfx file via $env:CODESIGN_PFX and $env:CODESIGN_PFX_PASSWORD.

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

$exe = Join-Path $PSScriptRoot "dist\AgencyPulseAgent\AgencyPulseAgent.exe"
if (-not (Test-Path $exe)) {
    throw "Build the agent first: .\build.bat"
}

$signtool = "${env:ProgramFiles(x86)}\Windows Kits\10\bin\10.0.22621.0\x64\signtool.exe"
if (-not (Test-Path $signtool)) {
    $signtool = Get-ChildItem "${env:ProgramFiles(x86)}\Windows Kits\10\bin" -Recurse -Filter signtool.exe |
        Sort-Object FullName -Descending |
        Select-Object -First 1 -ExpandProperty FullName
}

if (-not $signtool -or -not (Test-Path $signtool)) {
    throw "signtool.exe not found. Install the Windows SDK or sign manually."
}

$timestamp = "http://timestamp.digicert.com"
$args = @("sign", "/fd", "SHA256", "/tr", $timestamp, "/td", "SHA256")

if ($env:CODESIGN_PFX) {
    $args += @("/f", $env:CODESIGN_PFX)
    if ($env:CODESIGN_PFX_PASSWORD) {
        $args += @("/p", $env:CODESIGN_PFX_PASSWORD)
    }
} else {
    $args += @("/a")
}

$args += $exe
& $signtool @args

Write-Host "Signed: $exe"
Write-Host "Re-run build.bat to refresh AgencyPulseAgent.zip with the signed binary."
