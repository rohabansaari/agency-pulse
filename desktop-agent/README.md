# AgencyPulse Desktop Screenshot Agent

Minimal Windows agent for full-screen screenshots while the **web timer** is running.

- **Auto-starts capture** when you click **Start Timer** on the web app
- Full desktop capture every **5 minutes** (first capture immediately)
- Screenshots kept **60 days** on the server, then deleted automatically
- No Chrome extension or screen-share dialog

## How it works

1. **One-time install** on the employee PC (`AgencyPulseAgent.exe --install`)
2. **First run** — sign in with AgencyPulse email/password (saved locally)
3. **Start timer** on **Time Tracking** in the web app
4. The web app sends `agencypulse://wake` → agent wakes and uploads screenshots
5. **Stop timer** → capture pauses automatically

The agent also adds itself to **Windows Startup** so it is ready in the background after login.

## For employees (Windows)

### One-time setup (from your admin)

1. Run `AgencyPulseAgent.exe --install` *(or double-click `register-agent.ps1` if IT built from source)*
2. Double-click `AgencyPulseAgent.exe` once and sign in
3. Leave it running (or restart PC — it starts again from Startup)

### Daily use

1. Open AgencyPulse in the browser
2. Click **Start Timer** on `/time`
3. Screenshots begin automatically — view them on `/screenshots`

## For IT / admin

### Build single `.exe`

On a Windows machine with Python 3:

```bat
cd desktop-agent
build.bat
```

If you prefer PowerShell and scripts are blocked:

```powershell
powershell -ExecutionPolicy Bypass -File .\build.ps1
```

Distribute `dist\AgencyPulseAgent.exe` to employees.

### Install on employee PCs

```powershell
.\AgencyPulseAgent.exe --install
```

This registers the `agencypulse://` URL handler and adds a Startup shortcut.

Or run `register-agent.ps1` (builds first if needed).

### API URL

Default: `https://agency-pulse-api.onrender.com/api/v1`

Edit after first login: `%USERPROFILE%\.agencypulse\agent-config.json`

### Logs

`%USERPROFILE%\.agencypulse\agent.log`

### Re-login

Delete `agent-config.json` and run the agent again.

## macOS / Linux

Run with Python 3 (`pip install -r requirements.txt && python agent.py`). URL auto-wake and Startup install are Windows-only today.
