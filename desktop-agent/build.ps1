# Build a single Windows executable (no Python install needed for employees)
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

python -m pip install -r requirements.txt pyinstaller

python -m PyInstaller `
  --onefile `
  --windowed `
  --name AgencyPulseAgent `
  --hidden-import=tkinter `
  --hidden-import=mss `
  --hidden-import=PIL.Image `
  --hidden-import=requests `
  --clean `
  agent.py

Write-Host ""
Write-Host "Built: dist\AgencyPulseAgent.exe"
Write-Host "Run build.bat to create dist\AgencyPulseAgent.zip for web download."
Write-Host "Employees: extract zip, double-click exe, sign in once - no --install needed."
