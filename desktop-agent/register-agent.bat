@echo off
setlocal
cd /d "%~dp0"

if not exist "dist\AgencyPulseAgent.exe" (
  echo Building agent first...
  call "%~dp0build.bat"
  if errorlevel 1 exit /b 1
)

echo IT admin install (requires AGENCYPULSE_ADMIN=1 or .agencypulse-admin next to exe)...
set AGENCYPULSE_ADMIN=1
dist\AgencyPulseAgent.exe --install

echo.
echo Done. Employees should double-click the exe normally to sign in.
endlocal
