@echo off
setlocal
cd /d "%~dp0"

if not exist "dist\AgencyPulseAgent.exe" (
  echo Building agent first...
  call "%~dp0build.bat"
  if errorlevel 1 exit /b 1
)

echo Installing AgencyPulse Desktop Agent...
dist\AgencyPulseAgent.exe --install

echo.
echo Done. Run dist\AgencyPulseAgent.exe once to sign in.
endlocal
