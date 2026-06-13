"""
AgencyPulse Desktop Agent

Double-click to run — first-run setup, login, heartbeat, timer sync, and screenshots.
No CLI required for employees.
"""

from __future__ import annotations

import base64
import io
import json
import os
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, TypeVar

import mss
import requests
from PIL import Image

HEARTBEAT_INTERVAL_SECONDS = 30
TIMER_POLL_INTERVAL_SECONDS = 15
CAPTURE_INTERVAL_SECONDS = 300
MAX_IMAGE_WIDTH = 1600
JPEG_QUALITY = 60
MAX_RETRIES = 3
RETRY_DELAYS_SECONDS = (2, 4, 8)
DEFAULT_API_BASE_URL = "https://agencypulse-api.onrender.com/api/v1"
PROTOCOL = "agencypulse"

CONFIG_DIR = Path.home() / ".agencypulse"
CONFIG_PATH = CONFIG_DIR / "agent-config.json"
LOG_PATH = CONFIG_DIR / "agent.log"
LOCK_PATH = CONFIG_DIR / "agent.lock"
WAKE_PATH = CONFIG_DIR / "wake.signal"

_lock_handle = None
T = TypeVar("T")


def log(message: str) -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    line = f"{datetime.now().isoformat()} {message}"
    with LOG_PATH.open("a", encoding="utf-8") as handle:
        handle.write(line + "\n")
    if sys.stdout is not None and sys.stdout.isatty():
        print(line)


def notify_user(title: str, message: str) -> None:
    log(f"{title}: {message}")
    if sys.platform == "win32":
        try:
            import ctypes

            ctypes.windll.user32.MessageBoxW(0, message, title, 0x40)
        except Exception as error:
            log(f"Unable to show notification dialog: {error}")


def executable_path() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve()
    return Path(__file__).resolve()


def executable_command() -> str:
    target = executable_path()
    if getattr(sys, "frozen", False):
        return f'"{target}" "%1"'
    return f'"{Path(sys.executable).resolve()}" "{target}" "%1"'


def is_admin_mode() -> bool:
    if os.environ.get("AGENCYPULSE_ADMIN") == "1":
        return True
    return (executable_path().parent / ".agencypulse-admin").exists()


def register_protocol() -> bool:
    if sys.platform != "win32":
        log("Protocol registration skipped (Windows only).")
        return False

    import winreg

    command = executable_command()
    base = f"Software\\Classes\\{PROTOCOL}"

    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, base) as key:
        winreg.SetValue(key, None, winreg.REG_SZ, "URL:AgencyPulse Agent")
        winreg.SetValueEx(key, "URL Protocol", 0, winreg.REG_SZ, "")

    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, f"{base}\\DefaultIcon") as key:
        icon = executable_path()
        winreg.SetValue(key, None, winreg.REG_SZ, f"{icon},0")

    with winreg.CreateKey(
        winreg.HKEY_CURRENT_USER,
        f"{base}\\shell\\open\\command",
    ) as key:
        winreg.SetValue(key, None, winreg.REG_SZ, command)

    log(f"Registered {PROTOCOL}:// handler (current user).")
    return True


def add_startup_shortcut() -> bool:
    if sys.platform != "win32":
        log("Startup shortcut skipped (Windows only).")
        return False

    import subprocess

    target = executable_path()
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
        log("Could not add Startup shortcut.")
        if result.stderr:
            log(result.stderr.strip())
        return False

    log(f"Added startup shortcut: {shortcut_path}")
    return True


def run_first_run_setup(config: dict) -> dict:
    if config.get("setup_complete") or config.get("desktop_installed"):
        if config.get("desktop_installed") and not config.get("setup_complete"):
            config["setup_complete"] = True
            save_config(config)
        return config

    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    log("First-run setup: registering protocol and startup entry...")
    register_protocol()
    add_startup_shortcut()

    config["setup_complete"] = True
    config.setdefault("device_id", str(uuid.uuid4()))
    save_config(config)
    log("First-run setup complete.")
    return config


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
        time.sleep(min(0.5, max(0.0, deadline - time.time())))


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


def clear_auth(config: dict) -> dict:
    for key in ("token", "user_id", "organization_id"):
        config.pop(key, None)
    save_config(config)
    return config


def headers(config: dict) -> dict:
    return {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {config['token']}",
        "X-Organization-Id": str(config["organization_id"]),
    }


def default_api_base_url() -> str:
    configured = os.environ.get("AGENCYPULSE_API_URL", "").strip()
    if configured:
        return normalize_api_base_url(configured)
    return DEFAULT_API_BASE_URL


def normalize_api_base_url(raw: str) -> str:
    url = raw.strip().rstrip("/")
    if url.endswith("/api/v1"):
        return url
    if url.endswith("/api"):
        return f"{url}/v1"
    return f"{url}/api/v1"


def verify_api_reachable(api_base_url: str) -> str | None:
    health_url = f"{api_base_url.rstrip('/')}/health"
    try:
        response = requests.get(
            health_url,
            headers={"Accept": "application/json"},
            timeout=30,
        )
    except requests.RequestException as error:
        return f"Cannot reach AgencyPulse API at {health_url}: {error}"

    if response.status_code == 404:
        return (
            "API health check returned 404. The API URL is probably wrong — use the same URL "
            "as the website (for example https://agencypulse-api.onrender.com/api/v1)."
        )

    if response.status_code >= 400:
        return f"API health check failed ({response.status_code}) at {health_url}."

    return None


def parse_api_error(response: requests.Response) -> str:
    if response.status_code == 404:
        return (
            "API endpoint not found (404). Check the API URL — it must match your web app "
            f"(currently calling {response.url})."
        )

    try:
        body = response.json()
    except ValueError:
        return response.text[:300] or f"Request failed ({response.status_code})."

    message = body.get("message")
    if message:
        return str(message)

    errors = body.get("errors")
    if isinstance(errors, dict):
        for field_errors in errors.values():
            if isinstance(field_errors, list) and field_errors:
                return str(field_errors[0])

    return response.text[:300] or f"Request failed ({response.status_code})."


def with_retries(action: Callable[[], T | None], label: str) -> T | None:
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            result = action()
            if result is not None:
                return result
        except requests.RequestException as error:
            log(f"{label} attempt {attempt}/{MAX_RETRIES} failed: {error}")
        except RuntimeError as error:
            log(f"{label} attempt {attempt}/{MAX_RETRIES} failed: {error}")
            raise

        if attempt < MAX_RETRIES:
            delay = RETRY_DELAYS_SECONDS[attempt - 1]
            log(f"{label} retrying in {delay}s...")
            time.sleep(delay)

    log(f"{label} failed after {MAX_RETRIES} attempts.")
    return None


def validate_session(config: dict) -> bool:
    def attempt() -> bool | None:
        response = requests.get(
            f"{config['api_base_url']}/auth/me",
            headers=headers(config),
            timeout=30,
        )

        if response.status_code == 401:
            return False

        if response.status_code >= 400:
            log(f"Session validation failed ({response.status_code}): {parse_api_error(response)}")
            return None

        payload = response.json()
        user = payload.get("user") or {}
        user_id = user.get("id")
        organization_id = payload.get("current_organization_id")

        if not user_id or not organization_id:
            log("Session validation response missing user or organization.")
            return False

        config["user_id"] = int(user_id)
        config["organization_id"] = int(organization_id)
        save_config(config)
        return True

    try:
        result = with_retries(attempt, "Session validation")
    except RuntimeError:
        return False

    return result is True


def friendly_login_error(response: requests.Response) -> str:
    if response.status_code == 401:
        return "Invalid credentials. Please check your email and password."

    if response.status_code >= 500:
        return "AgencyPulse is temporarily unavailable. Please try again later."

    if response.status_code >= 400:
        return "Unable to sign in. Please verify your credentials and try again."

    return "Sign in failed. Please try again."


def prompt_login_gui(config: dict) -> dict:
    import tkinter as tk
    from tkinter import messagebox

    result: dict = {}
    api_base_url = normalize_api_base_url(config.get("api_base_url") or default_api_base_url())

    root = tk.Tk()
    root.title("AgencyPulse")
    root.resizable(False, False)
    root.geometry("460x440")
    root.configure(bg="#1c1917")

    canvas = tk.Canvas(root, width=460, height=440, highlightthickness=0, bg="#1c1917")
    canvas.pack(fill="both", expand=True)

    canvas.create_rectangle(0, 0, 460, 440, fill="#1c1917", outline="")
    canvas.create_oval(-60, -60, 180, 180, fill="#2d6a4f", outline="")
    canvas.create_oval(300, 280, 520, 500, fill="#4a5568", outline="")

    card = tk.Frame(root, bg="#faf9f6", padx=32, pady=32)
    canvas.create_window(230, 220, window=card, width=380, height=340)

    logo = tk.Label(
        card,
        text="AP",
        font=("Segoe UI", 14, "bold"),
        fg="#ffffff",
        bg="#2d6a4f",
        width=3,
        height=1,
    )
    logo.grid(row=0, column=0, sticky="w")

    title = tk.Label(
        card,
        text="AgencyPulse",
        font=("Segoe UI", 11, "bold"),
        fg="#18181b",
        bg="#faf9f6",
    )
    title.grid(row=0, column=1, sticky="w", padx=(8, 0))

    heading = tk.Label(
        card,
        text="Sign in to AgencyPulse",
        font=("Segoe UI", 16, "bold"),
        fg="#18181b",
        bg="#faf9f6",
    )
    heading.grid(row=1, column=0, columnspan=2, sticky="w", pady=(20, 4))

    subtitle = tk.Label(
        card,
        text="Connect your desktop agent to your workspace.",
        font=("Segoe UI", 9),
        fg="#71717a",
        bg="#faf9f6",
        wraplength=300,
        justify="left",
    )
    subtitle.grid(row=2, column=0, columnspan=2, sticky="w", pady=(0, 16))

    status_var = tk.StringVar(value="")
    status_label = tk.Label(
        card,
        textvariable=status_var,
        font=("Segoe UI", 9),
        fg="#2d6a4f",
        bg="#faf9f6",
    )
    status_label.grid(row=3, column=0, columnspan=2, sticky="w", pady=(0, 8))

    email_label = tk.Label(card, text="Email", font=("Segoe UI", 9), fg="#52525b", bg="#faf9f6")
    email_label.grid(row=4, column=0, columnspan=2, sticky="w")
    email_var = tk.StringVar()
    email_entry = tk.Entry(
        card,
        textvariable=email_var,
        font=("Segoe UI", 10),
        relief="solid",
        bd=1,
        highlightthickness=1,
        highlightcolor="#2d6a4f",
        highlightbackground="#e4e4e7",
    )
    email_entry.grid(row=5, column=0, columnspan=2, sticky="ew", ipady=6, pady=(4, 12))

    password_label = tk.Label(card, text="Password", font=("Segoe UI", 9), fg="#52525b", bg="#faf9f6")
    password_label.grid(row=6, column=0, columnspan=2, sticky="w")
    password_var = tk.StringVar()
    password_entry = tk.Entry(
        card,
        textvariable=password_var,
        show="*",
        font=("Segoe UI", 10),
        relief="solid",
        bd=1,
        highlightthickness=1,
        highlightcolor="#2d6a4f",
        highlightbackground="#e4e4e7",
    )
    password_entry.grid(row=7, column=0, columnspan=2, sticky="ew", ipady=6, pady=(4, 16))

    card.columnconfigure(0, weight=1)
    card.columnconfigure(1, weight=1)

    def submit() -> None:
        email = email_var.get().strip()
        password = password_var.get().strip()

        if not email or not password:
            messagebox.showerror("AgencyPulse", "Email and password are required.")
            return

        status_var.set("Connecting…")
        root.update_idletasks()

        health_error = verify_api_reachable(api_base_url)
        if health_error:
            status_var.set("")
            messagebox.showerror(
                "AgencyPulse",
                "Unable to connect to AgencyPulse. Check your internet connection and try again.",
            )
            return

        status_var.set("Authenticating…")
        root.update_idletasks()

        try:
            response = requests.post(
                f"{api_base_url}/auth/login",
                json={"email": email, "password": password},
                headers={"Accept": "application/json", "Content-Type": "application/json"},
                timeout=60,
            )
        except requests.RequestException:
            status_var.set("")
            messagebox.showerror(
                "AgencyPulse",
                "Connection failed. Please check your network and try again.",
            )
            return

        if response.status_code >= 400:
            status_var.set("")
            messagebox.showerror("AgencyPulse", friendly_login_error(response))
            return

        payload = response.json()
        token = payload.get("token")
        organization_id = payload.get("current_organization_id")
        user = payload.get("user") or {}
        user_id = user.get("id")

        if not token or not organization_id or not user_id:
            status_var.set("")
            messagebox.showerror(
                "AgencyPulse",
                "Sign in failed. Use an employee or manager account.",
            )
            return

        status_var.set("Connected!")
        result.update(
            {
                **config,
                "api_base_url": api_base_url,
                "token": token,
                "organization_id": int(organization_id),
                "user_id": int(user_id),
                "device_id": config.get("device_id") or str(uuid.uuid4()),
            }
        )
        root.after(400, root.destroy)

    sign_in_btn = tk.Button(
        card,
        text="Sign in",
        command=submit,
        font=("Segoe UI", 10, "bold"),
        fg="#ffffff",
        bg="#2d6a4f",
        activebackground="#245a42",
        activeforeground="#ffffff",
        relief="flat",
        padx=16,
        pady=8,
        cursor="hand2",
    )
    sign_in_btn.grid(row=8, column=0, columnspan=2, sticky="e")

    email_entry.focus_set()
    root.bind("<Return>", lambda _event: submit())
    root.mainloop()

    if not result:
        raise RuntimeError("Agent sign-in was cancelled.")

    save_config(result)
    return result


def ensure_config() -> dict:
    config = load_config()
    if config.get("api_base_url"):
        config["api_base_url"] = normalize_api_base_url(str(config["api_base_url"]))
    config = run_first_run_setup(config)

    if not config.get("device_id"):
        config["device_id"] = str(uuid.uuid4())
        save_config(config)

    if config.get("token") and config.get("organization_id"):
        if validate_session(config):
            log("Agent connected with saved credentials.")
            return config
        log("Saved session expired — sign in again.")
        config = clear_auth(config)

    try:
        return prompt_login_gui(config)
    except RuntimeError as error:
        notify_user(
            "AgencyPulse Agent",
            "Sign-in is required to run the desktop agent.\n\n"
            "Download AgencyPulseAgent.zip from the website, extract it, "
            "and double-click AgencyPulseAgent.exe.",
        )
        raise RuntimeError("Agent is not configured.") from error


def send_heartbeat(config: dict, offline: bool) -> bool:
    payload = {
        "user_id": config.get("user_id"),
        "device_id": config.get("device_id"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "status": "active",
    }

    def attempt() -> bool | None:
        response = requests.post(
            f"{config['api_base_url']}/agent/heartbeat",
            headers=headers(config),
            json=payload,
            timeout=30,
        )

        if response.status_code == 401:
            raise RuntimeError("Session expired.")

        if response.status_code >= 400:
            log(f"Heartbeat rejected ({response.status_code}): {parse_api_error(response)}")
            return None

        return True

    for attempt_index in range(2):
        try:
            if attempt() is True:
                if offline:
                    log("Agent back online.")
                return True
        except RuntimeError:
            raise
        except requests.RequestException as error:
            log(f"Heartbeat error: {error}")

        if attempt_index == 0:
            time.sleep(2)

    log("Heartbeat failed — continuing in offline mode.")
    return False


def fetch_active_timer(config: dict) -> dict | None:
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = requests.get(
                f"{config['api_base_url']}/time/today",
                headers=headers(config),
                timeout=60,
            )
        except requests.RequestException as error:
            log(f"Timer poll attempt {attempt}/{MAX_RETRIES} failed: {error}")
            if attempt < MAX_RETRIES:
                delay = RETRY_DELAYS_SECONDS[attempt - 1]
                log(f"Timer poll retrying in {delay}s...")
                time.sleep(delay)
            continue

        if response.status_code == 401:
            raise RuntimeError("Session expired.")

        if response.status_code >= 400:
            log(f"Timer check failed ({response.status_code}): {parse_api_error(response)}")
            if attempt < MAX_RETRIES:
                delay = RETRY_DELAYS_SECONDS[attempt - 1]
                log(f"Timer poll retrying in {delay}s...")
                time.sleep(delay)
            continue

        payload = response.json()
        meta = payload.get("meta") or {}
        return meta.get("active_timer")

    log("Timer poll failed after maximum retries.")
    return None


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
) -> bool:
    payload = {
        "image": capture_screen_base64(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "session_id": session_id,
        "project_id": project_id,
    }

    def attempt() -> bool | None:
        response = requests.post(
            f"{config['api_base_url']}/screenshots",
            headers=headers(config),
            json=payload,
            timeout=120,
        )

        if response.status_code == 401:
            raise RuntimeError("Session expired.")

        if response.status_code == 403:
            try:
                body = response.json()
            except ValueError:
                body = {}
            code = body.get("code")
            log(f"Upload rejected ({response.status_code}, code={code}): {parse_api_error(response)}")
            return False

        if response.status_code >= 400:
            log(f"Upload rejected ({response.status_code}): {parse_api_error(response)}")
            return None

        log("Screenshot uploaded successfully.")
        return True

    try:
        result = with_retries(attempt, "Screenshot upload")
    except RuntimeError:
        raise

    return result is True


class TimerSession:
    def __init__(self) -> None:
        self.active_entry_id: int | None = None
        self.session_id: str | None = None
        self.project_id: int | None = None
        self.last_capture_at: float = 0.0

    def clear(self) -> None:
        if self.active_entry_id is not None:
            log("Timer stopped. Screenshot capture paused.")
        self.active_entry_id = None
        self.session_id = None
        self.project_id = None
        self.last_capture_at = 0.0


def is_timer_running(timer: dict | None) -> bool:
    if not timer or not isinstance(timer, dict):
        return False
    return str(timer.get("status", "")).lower() == "running"


def handle_timer_state(
    config: dict,
    session: TimerSession,
    timer: dict | None,
    *,
    force_capture: bool = False,
) -> None:
    if not is_timer_running(timer):
        session.clear()
        return

    entry_id = int(timer["id"])
    project_id = timer.get("project_id")
    new_session = session.active_entry_id != entry_id

    if new_session:
        session.active_entry_id = entry_id
        session.session_id = str(uuid.uuid4())
        session.project_id = project_id
        session.last_capture_at = 0.0
        log(f"Timer active (entry {entry_id}). Taking first screenshot now.")
        force_capture = True

    should_capture = session.session_id is not None and (
        force_capture or time.time() - session.last_capture_at >= CAPTURE_INTERVAL_SECONDS
    )

    if not should_capture:
        return

    log("Capturing screenshot...")
    if upload_screenshot(config, session.session_id, session.project_id):
        session.last_capture_at = time.time()
        log("Screenshot capture cycle complete.")
    else:
        log("Screenshot upload failed — will retry on the next interval.")
        session.last_capture_at = time.time() - (CAPTURE_INTERVAL_SECONDS - 60)


def run_agent() -> None:
    config = ensure_config()
    session = TimerSession()
    offline = False
    loop_index = 0

    log("AgencyPulse agent running.")
    log(
        "Intervals: heartbeat 30s, timer poll 15s, screenshots 5m while timer is active."
    )

    while True:
        loop_index += 1
        wake_received = WAKE_PATH.exists()
        if wake_received:
            WAKE_PATH.unlink(missing_ok=True)
            log("Timer wake received — checking for active timer.")

        try:
            if loop_index % 2 == 1 or wake_received:
                offline = not send_heartbeat(config, offline)

            timer = fetch_active_timer(config)
            handle_timer_state(
                config,
                session,
                timer,
                force_capture=wake_received,
            )
        except RuntimeError as error:
            log(str(error))
            config = clear_auth(config)
            config = ensure_config()
            session.clear()
            offline = False
            continue

        sleep_until(TIMER_POLL_INTERVAL_SECONDS)


def admin_install() -> int:
    register_protocol()
    add_startup_shortcut()
    print("Admin install complete.")
    return 0


def main() -> int:
    args = [arg.lower() for arg in sys.argv[1:]]

    if "--install" in args or "--register" in args:
        if not is_admin_mode():
            notify_user(
                "AgencyPulse Agent",
                "This installation mode is restricted.\n\n"
                "Please run the application normally by double-clicking AgencyPulseAgent.exe.",
            )
            return 1
        return admin_install()

    if any(arg.lower().startswith(f"{PROTOCOL}://") for arg in sys.argv[1:]):
        if not acquire_lock():
            signal_wake()
            return 0
        log("Launched from browser timer wake.")

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
