# Build a single Windows executable (no Python install needed for employees)
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

python -m pip install -r requirements.txt pyinstaller

python -m PyInstaller `
  --onefile `
  --name AgencyPulseAgent `
  --clean `
  agent.py

Write-Host ""
Write-Host "Built: dist\AgencyPulseAgent.exe"
Write-Host "Copy that file to employee laptops and double-click to run."
