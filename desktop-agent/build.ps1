# Build a single Windows executable zip for web download (no Python needed for employees)
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

python -m pip install -r requirements.txt "pyinstaller>=6.10"

if (Test-Path "dist\AgencyPulseAgent.exe") {
    Remove-Item "dist\AgencyPulseAgent.exe" -Force
}
if (Test-Path "dist\AgencyPulseAgent") {
    Remove-Item "dist\AgencyPulseAgent" -Recurse -Force
}
if (Test-Path "dist\AgencyPulseAgent.zip") {
    Remove-Item "dist\AgencyPulseAgent.zip" -Force
}

python -m PyInstaller `
  --onefile `
  --windowed `
  --noupx `
  --name AgencyPulseAgent `
  --version-file version_info.txt `
  --hidden-import=tkinter `
  --hidden-import=mss `
  --hidden-import=PIL.Image `
  --hidden-import=requests `
  --clean `
  agent.py

Compress-Archive -Force -Path "dist\AgencyPulseAgent.exe" -DestinationPath "dist\AgencyPulseAgent.zip"

if (Test-Path "..\frontend\public\downloads\") {
    Copy-Item "dist\AgencyPulseAgent.zip" "..\frontend\public\downloads\AgencyPulseAgent.zip" -Force
    Write-Host "Copied zip to frontend\public\downloads\AgencyPulseAgent.zip"
}

Write-Host ""
Write-Host "Built: dist\AgencyPulseAgent.zip"
Write-Host "Inside: AgencyPulseAgent.exe"
Write-Host "Employees: extract zip, double-click exe, sign in once - no --install needed."
