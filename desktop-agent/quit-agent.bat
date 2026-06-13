@echo off
cd /d "%~dp0"
if exist "AgencyPulseAgent.exe" (
  AgencyPulseAgent.exe --quit
) else (
  python agent.py --quit
)
pause
