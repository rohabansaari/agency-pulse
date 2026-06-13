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
%PY% -m pip install -r requirements.txt "pyinstaller>=6.10"
if errorlevel 1 goto :error

if exist "dist\AgencyPulseAgent" rmdir /s /q "dist\AgencyPulseAgent"
if exist "dist\AgencyPulseAgent.zip" del /f /q "dist\AgencyPulseAgent.zip"

%PY% -m PyInstaller ^
  --onedir ^
  --windowed ^
  --noupx ^
  --name AgencyPulseAgent ^
  --version-file version_info.txt ^
  --hidden-import=tkinter ^
  --hidden-import=mss ^
  --hidden-import=PIL.Image ^
  --hidden-import=requests ^
  --clean ^
  agent.py
if errorlevel 1 goto :error

echo Creating zip (avoids Chrome blocking direct .exe downloads)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Compress-Archive -Force -Path 'dist\AgencyPulseAgent' -DestinationPath 'dist\AgencyPulseAgent.zip'"
if errorlevel 1 goto :error

if exist "..\frontend\public\downloads\" (
  copy /Y "dist\AgencyPulseAgent.zip" "..\frontend\public\downloads\AgencyPulseAgent.zip" >nul
  echo Copied zip to frontend\public\downloads\AgencyPulseAgent.zip
)

echo.
echo Built: dist\AgencyPulseAgent.zip
echo Inside: AgencyPulseAgent\AgencyPulseAgent.exe (+ dependencies)
echo Employees: download zip, extract folder, run exe once and sign in.
goto :end

:error
echo Build failed.
exit /b 1

:end
endlocal
