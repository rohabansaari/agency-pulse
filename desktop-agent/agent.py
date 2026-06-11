"""
AgencyPulse Desktop Screenshot Agent (minimal)

- Registers as agencypulse:// URL handler (one-time --register)
- Wakes automatically when the web timer starts (agencypulse://wake)
- Captures full-screen screenshots every 5 minutes while the timer is running
- Uploads to POST /api/v1/screenshots
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
POLL_INTERVAL_SECONDS = 15
MAX_IMAGE_WIDTH = 1600
JPEG_QUALITY = 60
MAX_UPLOAD_ATTEMPTS = 3
PROTOCOL = "agencypulse"

CONFIG_DIR = Path.home() / ".agencypulse"
CONFIG_PATH = CONFIG_DIR / "agent-config.json"
LOG_PATH = CONFIG_DIR / "agent.log"
LOCK_PATH = CONFIG_DIR / "agent.lock"
WAKE_PATH = CONFIG_DIR / "wake.signal"

_lock_handle = None


def log(message: str) -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    line = f"{datetime.now().isoformat()} {message}"
    print(line)
    with LOG_PATH.open("a", encoding="utf-8") as handle:
        handle.write(line + "\n")


def notify_user(title: str, message: str) -> None:
    log(f"{title}: {message}")
    if sys.platform == "win32":
        try:
            import ctypes

            ctypes.windll.user32.MessageBoxW(0, message, title, 0x40)
        except Exception as error:
            log(f"Unable to show notification dialog: {error}")


def executable_command() -> str:
    if getattr(sys, "frozen", False):
        return f'"{Path(sys.executable).resolve()}" "%1"'

    script = Path(__file__).resolve()
    return f'"{Path(sys.executable).resolve()}" "{script}" "%1"'


def register_protocol() -> int:
    if sys.platform != "win32":
        print("Protocol registration is supported on Windows only.")
        return 1

    import winreg

    command = executable_command()
    base = f"Software\\Classes\\{PROTOCOL}"

    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, base) as key:
        winreg.SetValue(key, None, winreg.REG_SZ, "URL:AgencyPulse Agent")
        winreg.SetValueEx(key, "URL Protocol", 0, winreg.REG_SZ, "")

    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, f"{base}\\DefaultIcon") as key:
        icon = Path(sys.executable if getattr(sys, "frozen", False) else __file__).resolve()
        winreg.SetValue(key, None, winreg.REG_SZ, f"{icon},0")

    with winreg.CreateKey(
        winreg.HKEY_CURRENT_USER,
        f"{base}\\shell\\open\\command",
    ) as key:
        winreg.SetValue(key, None, winreg.REG_SZ, command)

    log(f"Registered {PROTOCOL}:// handler.")
    print(f"Registered {PROTOCOL}:// — the web app can wake this agent when a timer starts.")
    return 0


def add_startup_shortcut() -> int:
    if sys.platform != "win32":
        print("Startup shortcut is supported on Windows only.")
        return 1

    import subprocess

    target = Path(sys.executable if getattr(sys, "frozen", False) else __file__).resolve()
    startup = (
        Path.home()
        / "AppData"
        / "Roaming"
        / "Microsoft"
        / "Windows"
        / "Start Menu"
        / "Programs"
        / "Startup"
    )
    startup.mkdir(parents=True, exist_ok=True)
    shortcut_path = startup / "AgencyPulse Agent.lnk"

    ps = (
        "$shell = New-Object -ComObject WScript.Shell; "
        f"$s = $shell.CreateShortcut('{shortcut_path}'); "
        f"$s.TargetPath = '{target}'; "
        f"$s.WorkingDirectory = '{target.parent}'; "
        "$s.Description = 'AgencyPulse screenshot agent'; "
        "$s.Save()"
    )
    result = subprocess.run(
        ["powershell", "-NoProfile", "-Command", ps],
        capture_output=True,
        text=True,
        check=False,
    )

    if result.returncode != 0:
        print("Could not add Startup shortcut. Add AgencyPulseAgent.exe to Startup manually.")
        if result.stderr:
            print(result.stderr.strip())
        return 1

    log(f"Added startup shortcut: {shortcut_path}")
    print("Agent will start automatically when you sign in to Windows.")
    return 0


def install_agent() -> int:
    code = register_protocol()
    if code != 0:
        return code

    if add_startup_shortcut() != 0:
        print("Protocol registered. Add AgencyPulseAgent.exe to Startup manually if needed.")

    return 0


def acquire_lock() -> bool:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    global _lock_handle

    if sys.platform == "win32":
        import msvcrt

        _lock_handle = open(LOCK_PATH, "a+")
        try:
            msvcrt.locking(_lock_handle.fileno(), msvcrt.LK_NBLCK, 1)
            return True
        except OSError:
            _lock_handle.close()
            _lock_handle = None
            return False

    try:
        import fcntl

        _lock_handle = open(LOCK_PATH, "a+")
        fcntl.flock(_lock_handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        return True
    except OSError:
        if _lock_handle is not None:
            _lock_handle.close()
            _lock_handle = None
        return False


def signal_wake() -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    WAKE_PATH.write_text(str(time.time()), encoding="utf-8")
    log("Wake signal sent to running agent.")


def sleep_until(seconds: float) -> None:
    deadline = time.time() + seconds
    while time.time() < deadline:
        if WAKE_PATH.exists():
            WAKE_PATH.unlink(missing_ok=True)
            return
        time.sleep(0.25)


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


def prompt_login_gui() -> dict:
    import tkinter as tk
    from tkinter import messagebox, ttk

    result: dict = {}
    default_api = "https://agency-pulse-api.onrender.com/api/v1"

    root = tk.Tk()
    root.title("AgencyPulse Desktop Agent")
    root.resizable(False, False)
    root.geometry("420x260")

    frame = ttk.Frame(root, padding=16)
    frame.pack(fill="both", expand=True)

    ttk.Label(frame, text="Sign in to enable screenshot capture", font=("Segoe UI", 11, "bold")).pack(
        anchor="w"
    )
    ttk.Label(frame, text="Your credentials are saved locally on this PC.").pack(anchor="w", pady=(4, 12))

    ttk.Label(frame, text="API URL").pack(anchor="w")
    api_var = tk.StringVar(value=default_api)
    ttk.Entry(frame, textvariable=api_var, width=52).pack(fill="x", pady=(0, 8))

    ttk.Label(frame, text="Email").pack(anchor="w")
    email_var = tk.StringVar()
    ttk.Entry(frame, textvariable=email_var, width=52).pack(fill="x", pady=(0, 8))

    ttk.Label(frame, text="Password").pack(anchor="w")
    password_var = tk.StringVar()
    ttk.Entry(frame, textvariable=password_var, show="*", width=52).pack(fill="x", pady=(0, 12))

    def submit() -> None:
        api_base_url = api_var.get().strip() or default_api
        email = email_var.get().strip()
        password = password_var.get().strip()

        if not email or not password:
            messagebox.showerror("AgencyPulse Agent", "Email and password are required.")
            return

        try:
            response = requests.post(
                f"{api_base_url.rstrip('/')}/auth/login",
                json={"email": email, "password": password},
                headers={"Accept": "application/json", "Content-Type": "application/json"},
                timeout=60,
            )
        except requests.RequestException as error:
            messagebox.showerror("AgencyPulse Agent", f"Login failed: {error}")
            return

        if response.status_code >= 400:
            messagebox.showerror("AgencyPulse Agent", f"Login failed: {response.text[:300]}")
            return

        payload = response.json()
        token = payload.get("token")
        organization_id = payload.get("current_organization_id")

        if not token or not organization_id:
            messagebox.showerror("AgencyPulse Agent", "Login response missing token or organization.")
            return

        result.update(
            {
                "api_base_url": api_base_url.rstrip("/"),
                "token": token,
                "organization_id": int(organization_id),
            }
        )
        root.destroy()

    ttk.Button(frame, text="Sign in", command=submit).pack(anchor="e")
    root.mainloop()

    if not result:
        raise RuntimeError("Agent sign-in was cancelled.")

    save_config(result)
    return result


def ensure_config() -> dict:
    config = load_config()
    if config.get("token") and config.get("organization_id"):
        return config

    launched_from_protocol = any(arg.lower().startswith(f"{PROTOCOL}://") for arg in sys.argv[1:])

    try:
        return prompt_login_gui()
    except Exception as error:
        message = (
            "AgencyPulse Desktop Agent is not set up on this PC.\n\n"
            "Double-click AgencyPulseAgent.exe once to sign in, then run:\n"
            "AgencyPulseAgent.exe --install"
        )
        notify_user("AgencyPulse Agent", message)
        log(f"Unable to complete first-time sign-in: {error}")
        if launched_from_protocol:
            log("Agent launched from browser before setup completed.")
        raise RuntimeError("Agent is not configured.") from error


def headers(config: dict) -> dict:
    return {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {config['token']}",
        "X-Organization-Id": str(config["organization_id"]),
    }


def send_heartbeat(config: dict) -> None:
    try:
        response = requests.post(
            f"{config['api_base_url']}/screenshots/agent-heartbeat",
            headers=headers(config),
            timeout=30,
        )
        if response.status_code >= 400:
            log(f"Heartbeat rejected ({response.status_code}): {response.text[:200]}")
    except requests.RequestException as error:
        log(f"Heartbeat error: {error}")


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
        log(f"Upload attempt {attempt}/{MAX_UPLOAD_ATTEMPTS} failed: {error}")
        if attempt < MAX_UPLOAD_ATTEMPTS:
            time.sleep(2 * attempt)
            return upload_screenshot(config, session_id, project_id, attempt + 1)
        log("Upload failed after maximum retries.")
        return False

    if response.status_code == 403:
        try:
            body = response.json()
        except ValueError:
            body = {}
        code = body.get("code")
        log(f"Upload rejected ({response.status_code}, code={code}): {response.text[:300]}")
        return False

    if response.status_code >= 500 and attempt < MAX_UPLOAD_ATTEMPTS:
        log(f"Upload attempt {attempt}/{MAX_UPLOAD_ATTEMPTS} failed with server error {response.status_code}.")
        time.sleep(2 * attempt)
        return upload_screenshot(config, session_id, project_id, attempt + 1)

    if response.status_code >= 400:
        log(f"Upload rejected ({response.status_code}): {response.text[:300]}")
        return False

    log(f"Screenshot uploaded successfully on attempt {attempt}.")
    return True


def run_agent() -> None:
    config = ensure_config()

    log("AgencyPulse agent running.")
    log("Start your timer in the web app — screenshots begin automatically.")

    active_entry_id: int | None = None
    session_id: str | None = None
    project_id: int | None = None
    last_capture_at: float = 0.0

    while True:
        if WAKE_PATH.exists():
            WAKE_PATH.unlink(missing_ok=True)
            log("Timer wake received — checking for active timer.")

        send_heartbeat(config)

        try:
            timer = fetch_active_timer(config)
        except RuntimeError as error:
            log(str(error))
            sleep_until(POLL_INTERVAL_SECONDS)
            continue

        if timer and timer.get("status") == "running":
            entry_id = int(timer["id"])
            project_id = timer.get("project_id")
            new_session = active_entry_id != entry_id

            if new_session:
                active_entry_id = entry_id
                session_id = str(uuid.uuid4())
                last_capture_at = 0.0
                log(f"Timer active (entry {entry_id}). Taking first screenshot now.")

            should_capture = session_id is not None and (
                new_session or time.time() - last_capture_at >= CAPTURE_INTERVAL_SECONDS
            )

            if should_capture and upload_screenshot(config, session_id, project_id):
                last_capture_at = time.time()
            elif should_capture:
                log("Screenshot capture failed; retrying in about 60 seconds.")
                last_capture_at = time.time() - (CAPTURE_INTERVAL_SECONDS - 60)
        else:
            if active_entry_id is not None:
                log("Timer stopped. Screenshot capture paused.")
            active_entry_id = None
            session_id = None
            project_id = None
            last_capture_at = 0.0

        sleep_until(POLL_INTERVAL_SECONDS)


def main() -> int:
    args = [arg.lower() for arg in sys.argv[1:]]

    if "--register" in args:
        return register_protocol()

    if "--install" in args:
        return install_agent()

    if not acquire_lock():
        signal_wake()
        return 0

    try:
        run_agent()
    except KeyboardInterrupt:
        log("Agent stopped.")
        return 0
    except RuntimeError as error:
        log(str(error))
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
