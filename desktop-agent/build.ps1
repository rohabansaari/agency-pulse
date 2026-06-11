# Build a single Windows executable (no Python install needed for employees)
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

python -m pip install -r requirements.txt pyinstaller

python -m PyInstaller `
  --onefile `
  --name AgencyPulseAgent `
  --hidden-import=tkinter `
  --clean `
  agent.py

Write-Host ""
Write-Host "Built: dist\AgencyPulseAgent.exe"
Write-Host "Run build.bat to create dist\AgencyPulseAgent.zip for web download."
Write-Host "Employees: extract zip, double-click exe, sign in once — no --install needed."
