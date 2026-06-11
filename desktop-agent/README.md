# AgencyPulse Desktop Screenshot Agent

The simplest desktop agent for full-screen screenshots while the **web timer** is running.

- No Chrome extension
- No “Share screen” dialog
- Full desktop capture every **5 minutes**
- Syncs with your timer on [AgencyPulse](https://agency-pulse-web.onrender.com)

## How it works

1. Employee runs the agent (once per PC, keeps running in background)
2. Employee starts the timer on **Time Tracking** in the web app
3. Agent detects the active timer via API and uploads screenshots every 5 minutes
4. When the timer stops, capture pauses automatically

## For employees (Windows)

### Option A — One executable (recommended)

Your admin builds `AgencyPulseAgent.exe` once (see **For IT** below) and shares it.

1. Double-click `AgencyPulseAgent.exe`
2. Enter email, password, and API URL on first run (saved locally)
3. Leave it running while you work
4. Use the website to **Start / Stop** your timer as usual

### Option B — Run with Python (dev / testing)

Requires Python 3.10+ installed.

```bat
cd desktop-agent
pip install -r requirements.txt
python agent.py
```

Or double-click `run.bat`.

## For IT / admin

### Build single `.exe` (no Python on employee PCs)

On a Windows machine with Python 3:

```powershell
cd desktop-agent
.\build.ps1
```

Distribute `dist\AgencyPulseAgent.exe` to employees (email, shared drive, or RMM).

### API URL

Default: `https://agency-pulse-api.onrender.com/api/v1`

Change in the first-run prompt or edit:

`%USERPROFILE%\.agencypulse\agent-config.json`

### Logs

`%USERPROFILE%\.agencypulse\agent.log`

### Requirements on employee PC

- Windows 10/11
- Internet access to your API
- Agent running in background (no other tools)

## Security notes

- Credentials are stored in `%USERPROFILE%\.agencypulse\agent-config.json` (Bearer token)
- Same permissions as the web app (`screenshots.upload` for employees)
- Re-login: delete `agent-config.json` and run again

## macOS / Linux

Run with Python 3 (`pip install -r requirements.txt && python agent.py`). One-file builds can be added later with PyInstaller on those platforms.
