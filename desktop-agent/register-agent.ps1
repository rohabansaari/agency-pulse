# One-time setup: register agencypulse:// URL handler + Windows Startup shortcut
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

$exe = Join-Path $PSScriptRoot "dist\AgencyPulseAgent.exe"
if (-not (Test-Path $exe)) {
    Write-Host "Building agent first..."
    & "$PSScriptRoot\build.ps1"
}

Write-Host "Installing AgencyPulse Desktop Agent..."
& $exe --install

Write-Host ""
Write-Host "Done. Run the agent once to sign in, then start your timer on the web app."
Write-Host "Screenshots will begin automatically when the timer starts."
