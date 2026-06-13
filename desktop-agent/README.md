# AgencyPulse Desktop Agent

Production desktop agent for screenshot capture while the web timer is running.

## Employee flow (no terminal commands)

1. Download **AgencyPulseAgent.zip** from the website
2. Extract the **AgencyPulseAgent** folder
3. Double-click `AgencyPulseAgent.exe` inside that folder
4. First-run setup runs automatically (protocol handler + Windows Startup)
5. Sign in once when prompted
6. Start your timer on the website — screenshots begin automatically

After setup, the agent runs in the background. No `--install`, no CLI, no manual registration.

## Timing

| Task | Interval |
|------|----------|
| Heartbeat | 30 seconds |
| Timer sync | 15 seconds |
| Screenshots | 5 minutes (only while timer is active) |

First screenshot is taken immediately when the timer starts.

## Config & logs

| Path | Purpose |
|------|---------|
| `%USERPROFILE%\.agencypulse\agent-config.json` | Token, user/org IDs, device ID |
| `%USERPROFILE%\.agencypulse\agent.log` | Agent activity log |

## Re-login

Delete `agent-config.json` and double-click the agent again.

## For IT / admin

### Build

```bat
cd desktop-agent
build.bat
```

Creates `dist\AgencyPulseAgent.zip` (contains the `AgencyPulseAgent` folder) and copies it to `frontend/public/downloads/` when that folder exists.

### Antivirus / SmartScreen warnings

The agent is a legitimate screenshot tool, but it is **unsigned** and packaged with PyInstaller. That combination often triggers false positives because the app:

- runs in the background while the web timer is active
- captures full-desktop screenshots
- registers a custom URL protocol and a Startup shortcut on first run

Mitigations in this repo:

- **onedir** packaging (no self-extracting one-file temp behavior)
- embedded Windows **version metadata** (`version_info.txt`)
- **UPX disabled** (`--noupx`)
- distributed as a **zip** only (no loose `.exe` in `frontend/public/downloads/`)

If Windows Defender or another AV still flags the download:

1. Rebuild with `build.bat` so the hosted zip matches the latest agent code.
2. Report a false positive to your AV vendor with the file SHA256.
3. For production rollouts, **code-sign** the exe (Authenticode certificate) — see `sign-agent.ps1`.

### Admin install mode (optional)

Normal employees should **never** use CLI flags. For IT troubleshooting only:

- Set environment variable `AGENCYPULSE_ADMIN=1`, or
- Place an empty `.agencypulse-admin` file next to the exe

Then run:

```bat
AgencyPulseAgent.exe --install
```

Without admin mode, `--install` shows a restriction message and exits.

### Deploy download

After building, commit `frontend/public/downloads/AgencyPulseAgent.zip` and redeploy the frontend.

Or host on CDN/R2 and set `NEXT_PUBLIC_AGENT_DOWNLOAD_URL` on Render.
