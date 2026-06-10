# AgencyPulse Chrome Extension

Browser-only screenshot monitor for the active Chrome tab.

## Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this `chrome-extension` folder

## Setup

1. Log in to AgencyPulse web app
2. Copy your Bearer token from browser devtools (`localStorage.agencypulse_token`)
3. Copy organization ID (`localStorage.agencypulse_organization_id`)
4. Paste both into the extension popup
5. Click **Start Tracking** (captures every 5 minutes — fixed, not configurable)

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
- Runs in the MV3 service worker (continues when popup is closed)
- Stops when Chrome is closed
- Skips `chrome://` and extension pages
- Compresses images before upload
- Retries once on server errors
