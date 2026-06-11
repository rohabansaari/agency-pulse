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
Write-Host "Deploy: copy exe to employees, then run: AgencyPulseAgent.exe --install"
