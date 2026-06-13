# Build a Windows agent folder and zip for web download (no Python needed for employees)
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

python -m pip install -r requirements.txt "pyinstaller>=6.10"

if (Test-Path "dist\AgencyPulseAgent") {
    Remove-Item "dist\AgencyPulseAgent" -Recurse -Force
}
if (Test-Path "dist\AgencyPulseAgent.zip") {
    Remove-Item "dist\AgencyPulseAgent.zip" -Force
}

python -m PyInstaller `
  --onedir `
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

Compress-Archive -Force -Path "dist\AgencyPulseAgent" -DestinationPath "dist\AgencyPulseAgent.zip"

if (Test-Path "..\frontend\public\downloads\") {
    Copy-Item "dist\AgencyPulseAgent.zip" "..\frontend\public\downloads\AgencyPulseAgent.zip" -Force
    Write-Host "Copied zip to frontend\public\downloads\AgencyPulseAgent.zip"
}

Write-Host ""
Write-Host "Built: dist\AgencyPulseAgent.zip"
Write-Host "Inside: AgencyPulseAgent\AgencyPulseAgent.exe (+ dependencies)"
Write-Host "Employees: extract zip, run exe, sign in once - no --install needed."
