"""
AgencyPulse Desktop Screenshot Agent (minimal)

- Watches your AgencyPulse timer via the API
- Captures full-screen screenshots every 5 minutes while the timer is running
- Uploads to POST /api/v1/screenshots

No browser extension or screen-share dialog required.
"""

from __future__ import annotations

import base64
import io
import json
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

import mss
import requests
from PIL import Image

CAPTURE_INTERVAL_SECONDS = 300
POLL_INTERVAL_SECONDS = 30
MAX_IMAGE_WIDTH = 1600
JPEG_QUALITY = 60

CONFIG_DIR = Path.home() / ".agencypulse"
CONFIG_PATH = CONFIG_DIR / "agent-config.json"
LOG_PATH = CONFIG_DIR / "agent.log"


def log(message: str) -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    line = f"{datetime.now().isoformat()} {message}"
    print(line)
    with LOG_PATH.open("a", encoding="utf-8") as handle:
        handle.write(line + "\n")


def load_config() -> dict:
    if not CONFIG_PATH.exists():
        return {}
    with CONFIG_PATH.open(encoding="utf-8") as handle:
        return json.load(handle)


def save_config(config: dict) -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    with CONFIG_PATH.open("w", encoding="utf-8") as handle:
        json.dump(config, handle, indent=2)
    log(f"Saved config to {CONFIG_PATH}")


def prompt_login() -> dict:
    print("AgencyPulse Desktop Agent — first-time setup")
    api_base_url = input(
        "API URL [https://agency-pulse-api.onrender.com/api/v1]: "
    ).strip() or "https://agency-pulse-api.onrender.com/api/v1"
    email = input("Email: ").strip()
    password = input("Password: ").strip()

    response = requests.post(
        f"{api_base_url.rstrip('/')}/auth/login",
        json={"email": email, "password": password},
        headers={"Accept": "application/json", "Content-Type": "application/json"},
        timeout=60,
    )

    if response.status_code >= 400:
        raise RuntimeError(f"Login failed: {response.text}")

    payload = response.json()
    token = payload.get("token")
    organization_id = payload.get("current_organization_id")

    if not token or not organization_id:
        raise RuntimeError("Login response missing token or organization_id.")

    config = {
        "api_base_url": api_base_url.rstrip("/"),
        "token": token,
        "organization_id": int(organization_id),
    }
    save_config(config)
    return config


def headers(config: dict) -> dict:
    return {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {config['token']}",
        "X-Organization-Id": str(config["organization_id"]),
    }


def fetch_active_timer(config: dict) -> dict | None:
    response = requests.get(
        f"{config['api_base_url']}/time/today",
        headers=headers(config),
        timeout=60,
    )

    if response.status_code == 401:
        raise RuntimeError("Session expired. Delete agent-config.json and run again to log in.")

    if response.status_code >= 400:
        log(f"Timer check failed ({response.status_code}): {response.text[:200]}")
        return None

    payload = response.json()
    meta = payload.get("meta") or {}
    return meta.get("active_timer")


def capture_screen_base64() -> str:
    with mss.mss() as grabber:
        monitor = grabber.monitors[0]
        shot = grabber.grab(monitor)
        image = Image.frombytes("RGB", shot.size, shot.bgra, "raw", "BGRX")

    if image.width > MAX_IMAGE_WIDTH:
        scale = MAX_IMAGE_WIDTH / image.width
        new_size = (MAX_IMAGE_WIDTH, max(1, int(image.height * scale)))
        image = image.resize(new_size, Image.Resampling.LANCZOS)

    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/jpeg;base64,{encoded}"


def upload_screenshot(
    config: dict,
    session_id: str,
    project_id: int | None,
    attempt: int = 1,
) -> bool:
    payload = {
        "image": capture_screen_base64(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "session_id": session_id,
        "project_id": project_id,
    }

    try:
        response = requests.post(
            f"{config['api_base_url']}/screenshots",
            headers=headers(config),
            json=payload,
            timeout=120,
        )
    except requests.RequestException as error:
        log(f"Upload error: {error}")
        if attempt < 3:
            time.sleep(2 * attempt)
            return upload_screenshot(config, session_id, project_id, attempt + 1)
        return False

    if response.status_code >= 500 and attempt < 3:
        time.sleep(2 * attempt)
        return upload_screenshot(config, session_id, project_id, attempt + 1)

    if response.status_code >= 400:
        log(f"Upload rejected ({response.status_code}): {response.text[:300]}")
        return False

    log("Screenshot uploaded.")
    return True


def run_agent() -> None:
    config = load_config()
    if not config.get("token") or not config.get("organization_id"):
        config = prompt_login()

    log("AgencyPulse agent running. Start your timer in the web app.")
    log("Captures full screen every 5 minutes while the timer is active.")

    active_entry_id: int | None = None
    session_id: str | None = None
    project_id: int | None = None
    last_capture_at: float = 0.0

    while True:
        try:
            timer = fetch_active_timer(config)
        except RuntimeError as error:
            log(str(error))
            time.sleep(POLL_INTERVAL_SECONDS)
            continue

        if timer and timer.get("status") == "running":
            entry_id = int(timer["id"])
            project_id = timer.get("project_id")

            if active_entry_id != entry_id:
                active_entry_id = entry_id
                session_id = str(uuid.uuid4())
                last_capture_at = 0.0
                log(f"Timer detected (entry {entry_id}). Screenshot session started.")

            now = time.time()
            if session_id and now - last_capture_at >= CAPTURE_INTERVAL_SECONDS:
                if upload_screenshot(config, session_id, project_id):
                    last_capture_at = now
                else:
                    last_capture_at = now - (CAPTURE_INTERVAL_SECONDS - 60)
        else:
            if active_entry_id is not None:
                log("Timer stopped. Screenshot capture paused.")
            active_entry_id = None
            session_id = None
            project_id = None
            last_capture_at = 0.0

        time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    try:
        run_agent()
    except KeyboardInterrupt:
        log("Agent stopped.")
        sys.exit(0)
