@echo off
setlocal
cd /d "%~dp0"

where python >nul 2>&1
if %errorlevel%==0 (
  set "PY=python"
) else (
  where py >nul 2>&1
  if %errorlevel%==0 (
    set "PY=py -3"
  ) else (
    echo Python 3 is not installed or not on PATH.
    echo Install from https://www.python.org/downloads/ and check "Add python.exe to PATH".
    exit /b 1
  )
)

echo Building AgencyPulse Desktop Agent...
%PY% -m pip install -r requirements.txt pyinstaller
if errorlevel 1 goto :error

%PY% -m PyInstaller --onefile --windowed --name AgencyPulseAgent --hidden-import=tkinter --clean agent.py
if errorlevel 1 goto :error

echo Creating zip (avoids Chrome blocking direct .exe downloads)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Compress-Archive -Force -Path 'dist\AgencyPulseAgent.exe' -DestinationPath 'dist\AgencyPulseAgent.zip'"
if errorlevel 1 goto :error

if exist "..\frontend\public\downloads\" (
  copy /Y "dist\AgencyPulseAgent.zip" "..\frontend\public\downloads\AgencyPulseAgent.zip" >nul
  echo Copied zip to frontend\public\downloads\AgencyPulseAgent.zip
)

echo.
echo Built: dist\AgencyPulseAgent.zip
echo Inside: AgencyPulseAgent.exe
echo Employees: download zip, extract, run exe once and sign in.
goto :end

:error
echo Build failed.
exit /b 1

:end
endlocal
