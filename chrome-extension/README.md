# AgencyPulse Chrome Extension

Browser-only screenshot monitor for the active Chrome tab. **Screenshots start automatically when an employee starts the time tracker** in the AgencyPulse web app.

## One-time install (required)

Chrome does not allow websites to install extensions silently. Each browser needs the extension **once**:

- **Best for companies:** IT deploys org-wide via [Chrome Enterprise policy](https://support.google.com/chrome/a/answer/6306504?hl=en) (force-install).
- **Dev / small teams:** Load unpacked in Chrome (see below).

After install, employees only use **Start Timer** on the Time Tracking page — no manual extension setup.

## Load unpacked (development)

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this `chrome-extension` folder
5. Reload the extension after code updates

## Production domain

The extension only connects to AgencyPulse on URLs listed in `manifest.json` → `content_scripts.matches`.

Add your live frontend URL before deploying, for example:

```json
"https://app.yourcompany.com/*"
```

## How auto-start works

1. Employee opens **Time Tracking** and clicks **Start Timer**
2. The web app sends a message to the extension (via content script)
3. Extension receives auth token + organization ID from the logged-in session
4. Screenshots capture every **5 minutes** (fixed)
5. When the timer stops, screenshot capture stops automatically

No bearer token copy/paste is needed for normal use.

## Manual fallback

The extension popup still has a manual connection section if the web app bridge fails.

## API contract

`POST /api/v1/screenshots`

```json
{
  "image": "data:image/jpeg;base64,...",
  "timestamp": "2026-06-11T12:00:00.000Z",
  "session_id": "uuid",
  "project_id": 123
}
```

Headers:

- `Authorization: Bearer <token>`
- `X-Organization-Id: <organization_id>`

## Behavior

- Captures only the **active tab** in the current window
- Fixed **5-minute** capture interval (not user-configurable)
- Starts/stops with the AgencyPulse time tracker
- Runs in the MV3 service worker (continues when popup is closed)
- Stops when Chrome is closed
- Skips `chrome://` and extension pages
- Compresses images before upload
- Retries once on server errors
