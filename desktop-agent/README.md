# AgencyPulse Desktop Screenshot Agent

Minimal Windows agent — **one-time setup**, then employees only start their web timer.

## Employee flow (after one-time setup)

1. Open AgencyPulse in the browser
2. Click **Start Timer** on Time Tracking
3. Screenshots capture automatically every 5 minutes

No extra steps, no "Check connection", no `--install` command.

## One-time setup (each PC)

1. Download **AgencyPulseAgent.zip** from the website (not the raw `.exe` — browsers block exe downloads)
2. Extract `AgencyPulseAgent.exe`
3. Double-click it and sign in once

The agent automatically registers with Windows, adds itself to Startup, and runs in the background.

## For IT / admin

### Build

```bat
cd desktop-agent
build.bat
```

This creates:

- `dist\AgencyPulseAgent.zip` — upload to `frontend/public/downloads/` for web download
- `dist\AgencyPulseAgent.exe` — inside the zip

PowerShell scripts blocked? `build.bat` works without changing execution policy.

### Deploy download file

After `build.bat`:

```bat
copy dist\AgencyPulseAgent.zip ..\frontend\public\downloads\AgencyPulseAgent.zip
```

Commit and redeploy the **frontend** so employees get the download link.

Or host the zip on R2/CDN and set `NEXT_PUBLIC_AGENT_DOWNLOAD_URL` on Render.

## Logs

`%USERPROFILE%\.agencypulse\agent.log`

## Re-login

Delete `%USERPROFILE%\.agencypulse\agent-config.json` and run the agent again.
