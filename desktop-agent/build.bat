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

%PY% -m PyInstaller --onefile --name AgencyPulseAgent --hidden-import=tkinter --clean agent.py
if errorlevel 1 goto :error

echo.
echo Built: dist\AgencyPulseAgent.exe
echo Next: copy to frontend\public\downloads\AgencyPulseAgent.exe for web download
echo       or distribute directly to employees, then run: AgencyPulseAgent.exe --install
goto :end

:error
echo Build failed.
exit /b 1

:end
endlocal
