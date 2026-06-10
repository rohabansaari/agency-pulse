# AgencyPulse Chrome Extension (optional)

**Render / normal users do not need this extension.**

The web app captures screenshots when an employee starts the time tracker using Chrome’s built-in **Share this tab** permission — no install step.

This extension is optional for organizations that deploy it via **Chrome Enterprise policy** (force-install for all staff).

## Production URL

The extension connects to:

- `https://agency-pulse-web.onrender.com/*`
- `http://localhost:3000/*` (development)

Add more domains in `manifest.json` → `content_scripts.matches` if you use a custom domain.

## Load unpacked (development only)

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select this folder

## Behavior when installed

- Timer start in the web app auto-starts extension capture (every 5 minutes)
- Timer stop stops capture
- If the extension is not installed, the web app uses browser tab sharing instead

## Enterprise deploy

Use [Chrome Enterprise force-install](https://support.google.com/chrome/a/answer/6306504) to push this extension to all employee browsers — still optional.
